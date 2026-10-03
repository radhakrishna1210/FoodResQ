"""Response builders: model rows → API JSON shapes (shared contract with the frontend)."""

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Allocation,
    AuditLog,
    Donation,
    DonorProfile,
    Feedback,
    MatchRun,
    Offer,
    ReceiverProfile,
    User,
)
from app.services.app_config import get_config
from app.services.deadlines import compute_deadlines
from app.services.uploads import signed_read_url
from app.utils.serialize import iso, to_dict


def user_dict(u: User) -> dict[str, Any]:
    return to_dict(u)


def profile_dict(db: Session, u: User) -> dict[str, Any] | None:
    if u.role == "donor":
        p = db.get(DonorProfile, u.id)
        return to_dict(p) if p else None
    if u.role == "receiver":
        p = db.get(ReceiverProfile, u.id)
        if p is None:
            return None
        out = to_dict(p)
        out["verification_doc_url"] = None  # only Admins get signed doc URLs
        return out
    return None


def _last_consumption(db: Session, d: Donation):
    return compute_deadlines(storage_condition=d.storage_condition, ambient_above_32c=d.ambient_above_32c,
                             prepared_at=d.prepared_at, packaged_expiry_date=d.packaged_expiry_date,
                             donor_pickup_by=d.donor_pickup_by, cfg=get_config(db)).last_consumption_at


def donation_summary(db: Session, d: Donation, *, include_photos: bool = True) -> dict[str, Any]:
    out = to_dict(d)
    dp = db.get(DonorProfile, d.donor_id)
    out["donor_org_name"] = dp.org_name if dp else None
    out["last_consumption_at"] = iso(_last_consumption(db, d))
    out["allocated_servings"] = int(db.execute(
        select(func.coalesce(func.sum(Allocation.servings), 0)).where(
            Allocation.donation_id == d.id, Allocation.status != "CANCELLED")).scalar_one())
    out["photo_urls"] = [signed_read_url("donation-photos", p) for p in d.photo_paths] if include_photos else []
    return out


def timeline(db: Session, d: Donation) -> list[dict[str, Any]]:
    rows = db.execute(select(AuditLog).where(AuditLog.entity_id == d.id,
                                             AuditLog.action == "donation.status_changed")
                      .order_by(AuditLog.id)).scalars().all()
    return [{"status": (r.after or {}).get("status"), "at": iso(r.created_at),
             "reason": (r.after or {}).get("reason")} for r in rows]


def allocation_dict(db: Session, a: Allocation, viewer: User, d: Donation | None = None) -> dict[str, Any]:
    d = d or db.get(Donation, a.donation_id)
    out = to_dict(a, exclude={"handover_code"})
    if viewer.id == a.receiver_id:
        out["handover_code"] = a.handover_code  # visible only to the Receiver
    dp = db.get(DonorProfile, d.donor_id)
    rp = db.get(ReceiverProfile, a.receiver_id)
    donor_user = db.get(User, d.donor_id)
    recv_user = db.get(User, a.receiver_id)
    active_party = a.status in ("ACCEPTED", "COLLECTED") or viewer.role == "admin"
    out.update({
        "donation": donation_summary(db, d, include_photos=False),
        "donor_org_name": dp.org_name if dp else None,
        "receiver_org_name": rp.org_name if rp else None,
        # Phone numbers only to the two parties of an active allocation (and Admins) — §15
        "donor_phone": d.contact_phone if active_party else None,
        "receiver_phone": recv_user.phone if (active_party and recv_user) else None,
        "donor_name": donor_user.full_name if donor_user else None,
        "receiver_lat": rp.lat if rp else None,
        "receiver_lng": rp.lng if rp else None,
        "pickup_address": d.pickup_address,
        "pickup_lat": d.pickup_lat,
        "pickup_lng": d.pickup_lng,
        "pickup_instructions": d.pickup_instructions,
        "effective_deadline": iso(d.effective_deadline),
        "feedback_submitted_by_me": db.execute(select(func.count()).select_from(Feedback).where(
            Feedback.allocation_id == a.id, Feedback.from_user_id == viewer.id)).scalar_one() > 0,
    })
    return out


def donation_detail(db: Session, d: Donation, viewer: User) -> dict[str, Any]:
    out = donation_summary(db, d)
    out["timeline"] = timeline(db, d)
    allocs = db.execute(select(Allocation).where(Allocation.donation_id == d.id)
                        .order_by(Allocation.accepted_at)).scalars().all()
    out["allocations"] = [allocation_dict(db, a, viewer, d) for a in allocs]
    out["pending_offers_count"] = db.execute(select(func.count()).select_from(Offer).where(
        Offer.donation_id == d.id, Offer.status == "PENDING")).scalar_one()
    return out


def offer_dict(db: Session, o: Offer) -> dict[str, Any]:
    out = to_dict(o)
    d = db.get(Donation, o.donation_id)
    out["donation"] = donation_summary(db, d)
    rp = db.get(ReceiverProfile, o.receiver_id)
    out["receiver_org_name"] = rp.org_name if rp else None
    alloc = db.execute(select(Allocation.id).where(Allocation.offer_id == o.id)).scalar_one_or_none()
    out["allocation_id"] = str(alloc) if alloc else None
    return out


def admin_donation_detail(db: Session, d: Donation, viewer: User) -> dict[str, Any]:
    out = donation_detail(db, d, viewer)
    runs = db.execute(select(MatchRun).where(MatchRun.donation_id == d.id).order_by(MatchRun.run_at)).scalars()
    out["match_runs"] = [to_dict(r) for r in runs]
    offers = db.execute(select(Offer).where(Offer.donation_id == d.id).order_by(Offer.offered_at)).scalars().all()
    names = dict(db.execute(select(ReceiverProfile.user_id, ReceiverProfile.org_name).where(
        ReceiverProfile.user_id.in_([o.receiver_id for o in offers]))).all()) if offers else {}
    out["offers"] = [{**to_dict(o), "receiver_org_name": names.get(o.receiver_id)} for o in offers]
    donor = db.get(User, d.donor_id)
    out["donor_name"] = donor.full_name if donor else None
    return out


def feedback_dict(f: Feedback | None) -> dict[str, Any] | None:
    return to_dict(f) if f else None
