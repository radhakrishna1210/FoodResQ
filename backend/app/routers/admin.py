"""Admin endpoints — ARCHITECTURE §10.5."""

import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import require_role
from app.db import get_db
from app.errors import NotFound
from app.models import (
    Allocation,
    AuditLog,
    Dispute,
    Donation,
    DonorProfile,
    ReceiverProfile,
    SafetyReport,
    User,
)
from app.routers.common import paginate
from app.schemas.requests import AssignIn, CreateAdminIn, DisputeResolveIn, ReasonIn, SafetyResolveIn
from app.services import admin as svc
from app.services import impact, jobs
from app.services.uploads import signed_read_url
from app.services.views import admin_donation_detail, allocation_dict, donation_summary, user_dict
from app.utils.serialize import iso, to_dict
from app.utils.serialize import page as page_out
from app.utils.time import IST, now_utc, today_ist

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = require_role("admin")


@router.get("/overview")
def overview(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    def count(stmt):
        return db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()

    start = datetime.combine(today_ist(), datetime.min.time(), tzinfo=IST)
    alerted = db.execute(select(Donation).where(Donation.no_match_alerted_at.is_not(None),
                                                Donation.status.in_(["POSTED", "MATCHED"]),
                                                Donation.remaining_servings > 0)
                         .order_by(Donation.no_match_alerted_at.desc()).limit(10)).scalars().all()
    names = dict(db.execute(select(DonorProfile.user_id, DonorProfile.org_name).where(
        DonorProfile.user_id.in_([d.donor_id for d in alerted]))).all()) if alerted else {}
    return {
        "pending_verifications": count(select(User.id).where(User.role == "receiver",
                                                             User.account_status == "pending_verification")),
        "flagged_donations": count(select(Donation.id).where(Donation.status == "FLAGGED")),
        "open_safety_reports": count(select(SafetyReport.id).where(SafetyReport.status == "open")),
        "open_disputes": count(select(Dispute.id).where(Dispute.status == "open")),
        "active_rescues": count(select(Donation.id).where(Donation.status.in_(["POSTED", "MATCHED", "ACCEPTED"]))),
        "meals_rescued_today": int(db.execute(select(func.coalesce(func.sum(Allocation.servings), 0)).where(
            Allocation.status.in_(["COLLECTED", "COMPLETED"]), Allocation.collected_at >= start)).scalar_one()),
        "recent_no_match_alerts": [{"donation_id": str(d.id), "title": d.title, "donor_org_name": names.get(d.donor_id),
                                    "remaining_servings": d.remaining_servings,
                                    "effective_deadline": iso(d.effective_deadline),
                                    "alerted_at": iso(d.no_match_alerted_at)} for d in alerted],
    }


@router.get("/verifications")
def verifications(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    rows = db.execute(select(User, ReceiverProfile).join(ReceiverProfile, ReceiverProfile.user_id == User.id)
                      .where(User.account_status == "pending_verification")
                      .order_by(ReceiverProfile.created_at)).all()
    return {"items": [{"user": user_dict(u), "profile": to_dict(p),
                       "doc_url": signed_read_url("verification-docs", p.verification_doc_path)} for u, p in rows]}


@router.post("/users/{user_id}/verify")
def verify(user_id: uuid.UUID, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    return user_dict(svc.verify_receiver(db, admin, user_id))


@router.post("/users/{user_id}/reject")
def reject(user_id: uuid.UUID, body: ReasonIn, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    return user_dict(svc.reject_receiver(db, admin, user_id, body.reason))


@router.post("/users/{user_id}/suspend")
def suspend(user_id: uuid.UUID, body: ReasonIn, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    return user_dict(svc.suspend(db, admin, user_id, body.reason))


@router.post("/users/{user_id}/reinstate")
def reinstate(user_id: uuid.UUID, body: ReasonIn, admin: User = Depends(admin_only),
              db: Session = Depends(get_db)):
    return user_dict(svc.reinstate(db, admin, user_id, body.reason))


@router.post("/donors/{user_id}/badge")
def badge(user_id: uuid.UUID, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    return to_dict(svc.toggle_donor_badge(db, admin, user_id))


@router.get("/flags")
def flags(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    rows = db.execute(select(Donation).where(Donation.status == "FLAGGED").order_by(Donation.effective_deadline))
    return {"items": [donation_summary(db, d) for d in rows.scalars()]}


@router.post("/donations/{donation_id}/approve")
def approve(donation_id: uuid.UUID, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    return admin_donation_detail(db, svc.approve_flagged(db, admin, donation_id), admin)


@router.post("/donations/{donation_id}/reject")
def reject_donation(donation_id: uuid.UUID, body: ReasonIn, admin: User = Depends(admin_only),
                    db: Session = Depends(get_db)):
    return admin_donation_detail(db, svc.reject_flagged(db, admin, donation_id, body.reason), admin)


@router.post("/donations/{donation_id}/assign")
def assign(donation_id: uuid.UUID, body: AssignIn, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    a = svc.manual_assign(db, admin, donation_id, body.receiver_id, body.servings, body.note)
    return allocation_dict(db, a, admin)


@router.get("/donations/{donation_id}")
def donation(donation_id: uuid.UUID, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    d = db.get(Donation, donation_id)
    if d is None:
        raise NotFound("Donation not found.")
    jobs.lazy_check_donation(db, donation_id)
    return admin_donation_detail(db, d, admin)


@router.get("/receivers")
def receivers(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    """Verified, active Receivers for the manual-assign picker.
    TODO(team): not listed in ARCHITECTURE §10.5; needed by the manual assign form."""
    rows = db.execute(select(User, ReceiverProfile).join(ReceiverProfile, ReceiverProfile.user_id == User.id)
                      .where(User.account_status == "active", ReceiverProfile.verified_at.is_not(None))).all()
    return {"items": [{"user_id": str(u.id), "org_name": p.org_name, "max_capacity_servings": p.max_capacity_servings,
                       "lat": p.lat, "lng": p.lng} for u, p in rows]}


@router.post("/allocations/{allocation_id}/override-collect")
def override_collect(allocation_id: uuid.UUID, body: ReasonIn, admin: User = Depends(admin_only),
                     db: Session = Depends(get_db)):
    from app.services import allocations

    return allocation_dict(db, allocations.admin_override_collect(db, allocation_id, admin, body.reason), admin)


@router.get("/safety-reports")
def safety_reports(status: str | None = None, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    stmt = select(SafetyReport).order_by(SafetyReport.created_at.desc())
    if status:
        stmt = stmt.where(SafetyReport.status == status)
    out = []
    for r in db.execute(stmt).scalars():
        dp = db.get(DonorProfile, r.donor_id)
        d = db.get(Donation, r.donation_id)
        out.append({**to_dict(r), "donor_org_name": dp.org_name if dp else None, "donation_title": d.title,
                    "photo_url": signed_read_url("feedback-photos", r.photo_path)})
    return {"items": out}


@router.post("/safety-reports/{report_id}/resolve")
def resolve_safety(report_id: uuid.UUID, body: SafetyResolveIn, admin: User = Depends(admin_only),
                   db: Session = Depends(get_db)):
    return to_dict(svc.resolve_safety_report(db, admin, report_id, body.status, body.admin_notes))


@router.get("/disputes")
def disputes(status: str | None = None, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    stmt = select(Dispute).order_by(Dispute.created_at.desc())
    if status:
        stmt = stmt.where(Dispute.status == status)
    out = []
    for dsp in db.execute(stmt).scalars():
        a = db.get(Allocation, dsp.allocation_id)
        raiser = db.get(User, dsp.raised_by)
        out.append({**to_dict(dsp), "donation_id": str(a.donation_id), "raised_by_name": raiser.full_name,
                    "raised_by_role": raiser.role})
    return {"items": out}


@router.post("/disputes/{dispute_id}/resolve")
def resolve_dispute(dispute_id: uuid.UUID, body: DisputeResolveIn, admin: User = Depends(admin_only),
                    db: Session = Depends(get_db)):
    return to_dict(svc.resolve_dispute(db, admin, dispute_id, body.resolution))


@router.get("/live")
def live(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    ds = db.execute(select(Donation).where(Donation.status.in_(["POSTED", "MATCHED", "FLAGGED", "ACCEPTED"]))
                    ).scalars().all()
    names = dict(db.execute(select(DonorProfile.user_id, DonorProfile.org_name)).all())
    allocs = db.execute(select(Allocation, Donation).join(Donation, Donation.id == Allocation.donation_id)
                        .where(Allocation.status == "ACCEPTED")).all()
    rnames = dict(db.execute(select(ReceiverProfile.user_id, ReceiverProfile.org_name)).all())
    rcoords = {r.user_id: (r.lat, r.lng) for r in db.execute(select(ReceiverProfile)).scalars()}
    return {
        "donations": [{"id": str(d.id), "title": d.title, "status": d.status, "priority_level": d.priority_level,
                       "remaining_servings": d.remaining_servings, "quantity_servings": d.quantity_servings,
                       "pickup_lat": d.pickup_lat, "pickup_lng": d.pickup_lng, "donor_org_name": names.get(d.donor_id),
                       "effective_deadline": iso(d.effective_deadline)} for d in ds],
        "allocations": [{"id": str(a.id), "donation_id": str(d.id), "status": a.status, "servings": a.servings,
                         "receiver_org_name": rnames.get(a.receiver_id), "donation_title": d.title,
                         "pickup_lat": d.pickup_lat, "pickup_lng": d.pickup_lng,
                         "receiver_lat": rcoords.get(a.receiver_id, (None, None))[0],
                         "receiver_lng": rcoords.get(a.receiver_id, (None, None))[1],
                         "effective_deadline": iso(d.effective_deadline)} for a, d in allocs],
    }


@router.get("/analytics")
def analytics(from_: datetime | None = Query(None, alias="from"), to: datetime | None = None,
              admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    end = to or now_utc()
    start = from_ or end - timedelta(days=30)
    return impact.analytics(db, start, end)


@router.get("/audit-log")
def audit_log(entity_id: uuid.UUID | None = None, page: int = 1, page_size: int = Query(50, le=100),
              admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    stmt = select(AuditLog).order_by(AuditLog.id.desc())
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    rows, p, ps, total = paginate(db, stmt, page, page_size)
    return page_out([to_dict(r) for r in rows], p, ps, total)


@router.get("/config")
def get_config(admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    return svc.get_config_values(db)


@router.put("/config")
def put_config(values: dict = Body(...), admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    return svc.put_config(db, admin, values)


@router.post("/admins", status_code=201)
def create_admin(body: CreateAdminIn, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    return user_dict(svc.create_admin(db, admin, body.user_id, body.email, body.full_name, body.phone))
