"""Allocations — collect, complete, cancel, no-show (ARCHITECTURE §5.3)."""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, Conflict, Forbidden, NotFound, ValidationFailed
from app.models import Allocation, Donation, DonorProfile, ReceiverProfile, User
from app.services import notifications as notif
from app.services import trust
from app.services.app_config import get_config
from app.services.donations import reevaluate_donation, return_servings_and_rematch
from app.services.matching.engine import lock_donation
from app.services.state import apply_transition
from app.utils.time import now_utc

MAX_HANDOVER_ATTEMPTS = 5


def lock_allocation(db: Session, allocation_id: uuid.UUID) -> Allocation | None:
    return db.execute(select(Allocation).where(Allocation.id == allocation_id).with_for_update()
                      .execution_options(populate_existing=True)).scalar_one_or_none()


def get_for_party(db: Session, allocation_id: uuid.UUID, user: User) -> tuple[Allocation, Donation]:
    """Allocation visible only to its Donor, its Receiver, or an Admin."""
    a = db.get(Allocation, allocation_id)
    if a is None:
        raise NotFound("Pickup not found.")
    d = db.get(Donation, a.donation_id)
    if user.role != "admin" and user.id not in (a.receiver_id, d.donor_id):
        raise NotFound("Pickup not found.")
    return a, d


def _mark_collected(db: Session, a: Allocation, d: Donation, actor_id: uuid.UUID, now: datetime,
                    reason: str | None = None) -> None:
    a.collected_at = now
    apply_transition(db, a, "allocation", "COLLECTED", actor_id=actor_id, reason=reason)
    notif.notify_many(db, [d.donor_id, a.receiver_id], "COLLECTED", "Food collected",
                      f"{a.servings} servings of \"{d.title}\" were collected. Thank you!",
                      f"/donor/donations/{d.id}")
    trust.recompute_reliability(db, a.receiver_id)
    reevaluate_donation(db, d)


def handover(db: Session, allocation_id: uuid.UUID, donor: User, code: str) -> Allocation:
    pre = db.get(Allocation, allocation_id)
    if pre is None:
        raise NotFound("Pickup not found.")
    d = lock_donation(db, pre.donation_id)
    if d is None or d.donor_id != donor.id:
        raise NotFound("Pickup not found.")
    a = lock_allocation(db, allocation_id)
    if a.status != "ACCEPTED":
        raise Conflict("This pickup is not waiting for a handover code.", code="INVALID_TRANSITION")
    if a.handover_attempts >= MAX_HANDOVER_ATTEMPTS:
        raise Conflict("Code entry is locked. The FoodResQ team has been notified.", code="HANDOVER_LOCKED")
    if code.strip() != a.handover_code:
        a.handover_attempts += 1
        left = MAX_HANDOVER_ATTEMPTS - a.handover_attempts
        if left == 0:
            notif.notify_admins(db, "HANDOVER_LOCKED", "Handover locked",
                                f"5 wrong handover codes for \"{d.title}\". Call both parties and override.",
                                f"/admin/donations/{d.id}")
            db.commit()  # persist the attempt counter even though we raise
            raise Conflict("Code entry is locked. The FoodResQ team has been notified.", code="HANDOVER_LOCKED")
        db.commit()
        raise AppError(f"Code doesn't match. {left} attempt{'s' if left != 1 else ''} left.",
                       code="HANDOVER_CODE_MISMATCH", status_code=422, details={"attempts_left": left})
    _mark_collected(db, a, d, donor.id, now_utc())
    return a


def admin_override_collect(db: Session, allocation_id: uuid.UUID, admin: User, reason: str) -> Allocation:
    if not reason or not reason.strip():
        raise ValidationFailed("A reason is required.", details={"fields": {"reason": "Required."}})
    pre = db.get(Allocation, allocation_id)
    if pre is None:
        raise NotFound("Pickup not found.")
    d = lock_donation(db, pre.donation_id)
    a = lock_allocation(db, allocation_id)
    if a.status != "ACCEPTED":
        raise Conflict("Only accepted pickups can be marked collected.", code="INVALID_TRANSITION")
    _mark_collected(db, a, d, admin.id, now_utc(), reason=f"admin_override: {reason}")
    return a


def receiver_cancel(db: Session, allocation_id: uuid.UUID, receiver: User, reason: str) -> Allocation:
    if not reason or not reason.strip():
        raise ValidationFailed("Please give a reason.", details={"fields": {"reason": "Required."}})
    pre = db.get(Allocation, allocation_id)
    if pre is None or pre.receiver_id != receiver.id:
        raise NotFound("Pickup not found.")
    d = lock_donation(db, pre.donation_id)
    a = lock_allocation(db, allocation_id)
    if a.status != "ACCEPTED":
        raise Conflict("You can only cancel before collection.", code="INVALID_TRANSITION")
    now = now_utc()
    a.cancelled_at, a.cancelled_by, a.cancel_reason = now, receiver.id, reason
    apply_transition(db, a, "allocation", "CANCELLED", actor_id=receiver.id, reason=reason)
    rp = db.get(ReceiverProfile, receiver.id)
    notif.notify(db, d.donor_id, "ALLOCATION_CANCELLED", "Pickup cancelled",
                 f"{rp.org_name if rp else 'The Receiver'} cancelled their pickup. We're finding another Receiver.",
                 f"/donor/donations/{d.id}")
    trust.recompute_reliability(db, receiver.id)
    return_servings_and_rematch(db, d, a.servings, now)
    return a


def complete(db: Session, allocation_id: uuid.UUID, receiver: User, servings_distributed: int,
             distribution_area: str) -> Allocation:
    pre = db.get(Allocation, allocation_id)
    if pre is None or pre.receiver_id != receiver.id:
        raise NotFound("Pickup not found.")
    d = lock_donation(db, pre.donation_id)
    a = lock_allocation(db, allocation_id)
    if a.status != "COLLECTED":
        raise Conflict("Confirm distribution after the food is collected.", code="INVALID_TRANSITION")
    if not 0 <= servings_distributed <= a.servings:
        raise ValidationFailed("Servings distributed can't exceed servings collected.",
                               details={"fields": {"servings_distributed": f"Must be 0–{a.servings}."}})
    if not distribution_area or not distribution_area.strip():
        raise ValidationFailed("Please enter the distribution area.",
                               details={"fields": {"distribution_area": "Required."}})
    now = now_utc()
    a.servings_distributed, a.distribution_area = servings_distributed, distribution_area.strip()
    a.distributed_at = a.completed_at = now
    _complete(db, a, d, receiver.id)
    return a


def _complete(db: Session, a: Allocation, d: Donation, actor_id: uuid.UUID | None) -> None:
    apply_transition(db, a, "allocation", "COMPLETED", actor_id=actor_id,
                     extra={"completion_unconfirmed": a.completion_unconfirmed})
    rp = db.get(ReceiverProfile, a.receiver_id)
    notif.notify(db, d.donor_id, "COMPLETED", "Food distributed",
                 f"{rp.org_name if rp else 'The Receiver'} distributed {a.servings_distributed or a.servings} "
                 "servings.", f"/donor/donations/{d.id}")
    notif.notify_many(db, [d.donor_id, a.receiver_id], "FEEDBACK_REQUEST", "How did it go?",
                      "Please share quick feedback about this rescue.", f"/allocations/{a.id}/feedback")
    reevaluate_donation(db, d)


def auto_complete(db: Session, a: Allocation, now: datetime) -> bool:
    cfg = get_config(db)
    if a.status != "COLLECTED" or a.collected_at is None or \
            a.collected_at > now - timedelta(hours=cfg["auto_complete_hours"]):
        return False
    d = lock_donation(db, a.donation_id)
    a = lock_allocation(db, a.id)
    if a.status != "COLLECTED":
        return False
    a.completion_unconfirmed = True
    a.completed_at = now
    _complete(db, a, d, None)
    return True


def mark_no_show(db: Session, a: Allocation, now: datetime) -> bool:
    cfg = get_config(db)
    d = lock_donation(db, a.donation_id)
    a = lock_allocation(db, a.id)
    if a.status != "ACCEPTED" or d.effective_deadline + timedelta(minutes=cfg["no_show_grace_minutes"]) >= now:
        return False
    apply_transition(db, a, "allocation", "NO_SHOW", actor_id=None)
    rp = db.get(ReceiverProfile, a.receiver_id)
    msg = f"{rp.org_name if rp else 'The Receiver'} did not collect \"{d.title}\" in time."
    notif.notify_many(db, [d.donor_id, a.receiver_id], "NO_SHOW", "Pickup missed", msg, f"/donor/donations/{d.id}")
    notif.notify_admins(db, "NO_SHOW", "Pickup missed", msg, f"/admin/donations/{d.id}")
    trust.recompute_reliability(db, a.receiver_id)
    reevaluate_donation(db, d)
    return True


def donor_and_receiver_names(db: Session, a: Allocation, d: Donation) -> tuple[str, str]:
    dp = db.get(DonorProfile, d.donor_id)
    rp = db.get(ReceiverProfile, a.receiver_id)
    return (dp.org_name if dp else ""), (rp.org_name if rp else "")


def ensure_party(a: Allocation, d: Donation, user: User) -> str:
    if user.id == a.receiver_id:
        return "receiver"
    if user.id == d.donor_id:
        return "donor"
    raise Forbidden("Only the Donor and Receiver of this pickup can do that.")
