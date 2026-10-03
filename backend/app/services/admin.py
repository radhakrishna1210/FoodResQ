"""Admin actions — ARCHITECTURE §10.5. Every Admin action is audited."""

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import Conflict, NotFound, ValidationFailed
from app.models import (
    Allocation,
    AppConfig,
    Dispute,
    DonorProfile,
    Offer,
    ReceiverProfile,
    SafetyReport,
    User,
)
from app.services import notifications as notif
from app.services import trust
from app.services.app_config import DEFAULT_CONFIG, WEIGHT_KEYS, invalidate_cache, validate_weights
from app.services.audit import write_audit
from app.services.matching.engine import capacity_available_for, lock_donation, run_matching
from app.services.offers import new_handover_code
from app.services.state import apply_transition, init_status
from app.utils.time import now_utc


def _require_reason(reason: str | None, field: str = "reason") -> str:
    if not reason or not reason.strip():
        raise ValidationFailed("A reason is required.", details={"fields": {field: "Required."}})
    return reason.strip()


def _user(db: Session, user_id: uuid.UUID) -> User:
    u = db.get(User, user_id)
    if u is None:
        raise NotFound("User not found.")
    return u


def _set_status(db: Session, admin: User, u: User, status: str, action: str, reason: str | None = None) -> None:
    before = u.account_status
    u.account_status = status
    u.updated_at = now_utc()
    write_audit(db, actor_id=admin.id, action=action, entity_type="user", entity_id=u.id,
                before={"account_status": before}, after={"account_status": status, "reason": reason})


def verify_receiver(db: Session, admin: User, user_id: uuid.UUID) -> User:
    u = _user(db, user_id)
    p = db.get(ReceiverProfile, user_id)
    if u.role != "receiver" or p is None:
        raise Conflict("Only Receivers need verification.")
    p.verified_at, p.verified_by, p.rejection_reason = now_utc(), admin.id, None
    _set_status(db, admin, u, "active", "user.verified")
    notif.notify(db, u.id, "VERIFICATION_RESULT", "You're verified!",
                 "Your organisation is verified. You can now receive food offers.", "/receiver")
    return u


def reject_receiver(db: Session, admin: User, user_id: uuid.UUID, reason: str) -> User:
    reason = _require_reason(reason)
    u = _user(db, user_id)
    p = db.get(ReceiverProfile, user_id)
    if u.role != "receiver" or p is None:
        raise Conflict("Only Receivers need verification.")
    p.rejection_reason, p.verified_at = reason, None
    _set_status(db, admin, u, "rejected", "user.rejected", reason)
    notif.notify(db, u.id, "VERIFICATION_RESULT", "Verification unsuccessful", reason, "/pending")
    return u


def suspend(db: Session, admin: User, user_id: uuid.UUID, reason: str) -> User:
    reason = _require_reason(reason)
    u = _user(db, user_id)
    if u.role == "admin":
        raise Conflict("Admins can't be suspended here.")
    _set_status(db, admin, u, "suspended", "user.suspended", reason)
    if u.role == "receiver":  # existing PENDING offers are WITHDRAWN (WALKTHROUGH §6.13)
        for o in db.execute(select(Offer).where(Offer.receiver_id == u.id, Offer.status == "PENDING")).scalars():
            apply_transition(db, o, "offer", "WITHDRAWN", actor_id=admin.id, reason="receiver_suspended")
    return u


def reinstate(db: Session, admin: User, user_id: uuid.UUID, reason: str) -> User:
    reason = _require_reason(reason)
    u = _user(db, user_id)
    if u.account_status != "suspended":
        raise Conflict("This account is not suspended.")
    target = "active"
    if u.role == "receiver":
        p = db.get(ReceiverProfile, user_id)
        target = "active" if p and p.verified_at else "pending_verification"
    _set_status(db, admin, u, target, "user.reinstated", reason)
    return u


def toggle_donor_badge(db: Session, admin: User, user_id: uuid.UUID) -> DonorProfile:
    p = db.get(DonorProfile, user_id)
    if p is None:
        raise NotFound("Donor not found.")
    p.is_verified = not p.is_verified
    write_audit(db, actor_id=admin.id, action="donor.badge_toggled", entity_type="user", entity_id=user_id,
                after={"is_verified": p.is_verified})
    return p


def approve_flagged(db: Session, admin: User, donation_id: uuid.UUID):
    d = lock_donation(db, donation_id)
    if d is None:
        raise NotFound("Donation not found.")
    apply_transition(db, d, "donation", "POSTED", actor_id=admin.id, reason="admin_approved")
    notif.notify(db, d.donor_id, "DONATION_APPROVED", "Donation approved",
                 f"\"{d.title}\" was approved. We're finding the best Receiver.", f"/donor/donations/{d.id}")
    db.flush()
    run_matching(db, d.id, "approved")
    return d


def reject_flagged(db: Session, admin: User, donation_id: uuid.UUID, reason: str):
    reason = _require_reason(reason)
    d = lock_donation(db, donation_id)
    if d is None:
        raise NotFound("Donation not found.")
    if d.status != "FLAGGED":
        raise Conflict("Only flagged donations can be rejected here.", code="INVALID_TRANSITION")
    d.cancel_reason = reason
    apply_transition(db, d, "donation", "CANCELLED", actor_id=admin.id, reason=reason)
    notif.notify(db, d.donor_id, "DONATION_REJECTED", "Donation not approved", reason, f"/donor/donations/{d.id}")
    return d


def manual_assign(db: Session, admin: User, donation_id: uuid.UUID, receiver_id: uuid.UUID, servings: int,
                  note: str) -> Allocation:
    """Bypasses filters except not_verified; requires a note (§7.8)."""
    note = _require_reason(note, "note")
    d = lock_donation(db, donation_id)
    if d is None:
        raise NotFound("Donation not found.")
    if d.status not in ("POSTED", "MATCHED") or d.remaining_servings <= 0:
        raise Conflict("This donation has no servings left to assign.", code="DONATION_NOT_AVAILABLE")
    u = db.get(User, receiver_id)
    p = db.get(ReceiverProfile, receiver_id)
    if u is None or p is None or u.role != "receiver" or u.account_status != "active" or p.verified_at is None:
        raise Conflict("Only verified, active Receivers can be assigned.", code="NOT_VERIFIED")
    servings = min(servings, d.remaining_servings)
    if servings < 1:
        raise ValidationFailed("Servings must be at least 1.", details={"fields": {"servings": "≥ 1"}})
    from app.services.app_config import get_config
    from app.services.matching.geo import eta_minutes, road_distance_km

    cfg = get_config(db)
    eta = eta_minutes(road_distance_km(d.pickup_lat, d.pickup_lng, p.lat, p.lng, cfg["road_factor"]),
                      cfg["prep_buffer_minutes"], cfg["avg_speed_kmph"])
    now = now_utc()
    a = Allocation(donation_id=d.id, receiver_id=receiver_id, offer_id=None, servings=servings,
                   handover_code=new_handover_code(), accepted_at=now, eta_at=now + timedelta(minutes=eta))
    init_status(db, a, "allocation", "ACCEPTED", actor_id=admin.id,
                extra={"manual": True, "note": note, "capacity_available": capacity_available_for(db, receiver_id)})
    d.remaining_servings -= servings
    if d.remaining_servings == 0:
        for o in db.execute(select(Offer).where(Offer.donation_id == d.id, Offer.status == "PENDING")).scalars():
            apply_transition(db, o, "offer", "SUPERSEDED", actor_id=admin.id)
            notif.notify(db, o.receiver_id, "OFFER_SUPERSEDED", "Offer taken",
                         "This food was taken by another Receiver.", f"/receiver/offers/{o.id}")
        apply_transition(db, d, "donation", "ACCEPTED", actor_id=admin.id)
    notif.notify(db, receiver_id, "OFFER_ACCEPTED", "Pickup assigned by FoodResQ",
                 f"You've been assigned {servings} servings of \"{d.title}\".", f"/receiver/pickups/{a.id}")
    notif.notify(db, d.donor_id, "OFFER_ACCEPTED", "Receiver assigned",
                 f"{p.org_name} was assigned {servings} servings.", f"/donor/donations/{d.id}")
    return a


def resolve_safety_report(db: Session, admin: User, report_id: uuid.UUID, status: str, notes: str | None):
    if status not in ("resolved_valid", "resolved_invalid"):
        raise ValidationFailed("Invalid status.", details={"fields": {"status": "resolved_valid|resolved_invalid"}})
    r = db.get(SafetyReport, report_id)
    if r is None:
        raise NotFound("Report not found.")
    if r.status != "open":
        raise Conflict("This report is already resolved.")
    r.status, r.admin_notes, r.resolved_by, r.resolved_at = status, notes, admin.id, now_utc()
    write_audit(db, actor_id=admin.id, action="safety_report.resolved", entity_type="safety_report",
                entity_id=r.id, after={"status": status})
    trust.recompute_quality(db, r.donor_id)
    if status == "resolved_valid":
        trust.check_auto_suspension(db, r.donor_id)
    return r


def resolve_dispute(db: Session, admin: User, dispute_id: uuid.UUID, resolution: str):
    resolution = _require_reason(resolution, "resolution")
    dsp = db.get(Dispute, dispute_id)
    if dsp is None:
        raise NotFound("Dispute not found.")
    if dsp.status != "open":
        raise Conflict("This dispute is already resolved.")
    dsp.status, dsp.resolution, dsp.resolved_by, dsp.resolved_at = "resolved", resolution, admin.id, now_utc()
    write_audit(db, actor_id=admin.id, action="dispute.resolved", entity_type="dispute", entity_id=dsp.id,
                after={"resolution": resolution})
    a = db.get(Allocation, dsp.allocation_id)
    from app.models import Donation

    d = db.get(Donation, a.donation_id)
    notif.notify_many(db, [a.receiver_id, d.donor_id], "DISPUTE_RESOLVED", "Dispute resolved", resolution[:200],
                      f"/donor/donations/{d.id}")
    return dsp


def get_config_values(db: Session) -> dict[str, Any]:
    rows = {r.key: r.value for r in db.execute(select(AppConfig)).scalars()}
    return {k: rows.get(k, v) for k, v in DEFAULT_CONFIG.items()}


def put_config(db: Session, admin: User, values: dict[str, Any]) -> dict[str, Any]:
    unknown = set(values) - set(DEFAULT_CONFIG)
    if unknown:
        raise ValidationFailed("Unknown settings: " + ", ".join(sorted(unknown)))
    for k in WEIGHT_KEYS:
        if k in values:
            validate_weights(values[k])
    for k, v in values.items():
        row = db.get(AppConfig, k)
        before = row.value if row else None
        if row is None:
            db.add(AppConfig(key=k, value=v, updated_by=admin.id))
        else:
            row.value, row.updated_by, row.updated_at = v, admin.id, now_utc()
        write_audit(db, actor_id=admin.id, action="config.updated", entity_type="app_config",
                    entity_id=uuid.uuid5(uuid.NAMESPACE_URL, f"app_config:{k}"), before={"value": before},
                    after={"value": v})
    db.flush()
    invalidate_cache()
    return get_config_values(db)


def create_admin(db: Session, admin: User, user_id: uuid.UUID, email: str, full_name: str, phone: str) -> User:
    """Creates the `users` row for an existing Supabase Auth user. TODO(team): optionally create the
    Supabase Auth user via the admin API here as well."""
    if db.get(User, user_id) is not None:
        raise Conflict("This user already exists.")
    u = User(id=user_id, role="admin", full_name=full_name, email=email.lower(), phone=phone,
             account_status="active")
    db.add(u)
    db.flush()
    write_audit(db, actor_id=admin.id, action="user.admin_created", entity_type="user", entity_id=u.id,
                after={"email": email})
    return u
