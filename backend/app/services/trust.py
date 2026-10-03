"""Trust scores — ARCHITECTURE §13."""

import uuid
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Allocation,
    Donation,
    DonorProfile,
    Feedback,
    Offer,
    ReceiverProfile,
    SafetyReport,
    User,
)
from app.services import notifications as notif
from app.services.audit import write_audit
from app.utils.time import now_utc

PRIOR = 0.7
PRIOR_WEIGHT = 5


def _q(x: float) -> Decimal:
    return Decimal(str(max(0.0, min(1.0, x)))).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def reliability_formula(*, accepted: int, offers_total: int, on_time: int, allocs_total: int,
                        avg_rating: float | None, no_shows_30d: int) -> float:
    acceptance_rate = accepted / offers_total if offers_total else PRIOR
    on_time_rate = on_time / allocs_total if allocs_total else PRIOR
    rating_norm = (avg_rating - 1) / 4 if avg_rating is not None else PRIOR
    raw = 0.35 * acceptance_rate + 0.35 * on_time_rate + 0.30 * rating_norm
    n = allocs_total
    rel = (raw * n + PRIOR * PRIOR_WEIGHT) / (n + PRIOR_WEIGHT)
    return max(0.0, rel - 0.05 * no_shows_30d)


def quality_formula(*, avg_rating: float | None, fresh_true: int, n: int, valid_reports_90d: int) -> float:
    rating_norm = (avg_rating - 1) / 4 if avg_rating is not None else PRIOR
    fresh_rate = fresh_true / n if n else PRIOR
    raw = 0.5 * rating_norm + 0.5 * fresh_rate
    q = (raw * n + PRIOR * PRIOR_WEIGHT) / (n + PRIOR_WEIGHT)
    return max(0.0, q - 0.2 * valid_reports_90d)


def recompute_reliability(db: Session, receiver_id: uuid.UUID) -> Decimal | None:
    profile = db.get(ReceiverProfile, receiver_id)
    if profile is None:
        return None
    db.flush()
    now = now_utc()
    offer_counts = dict(db.execute(select(Offer.status, func.count()).where(
        Offer.receiver_id == receiver_id, Offer.status.in_(["ACCEPTED", "DECLINED", "TIMED_OUT"]))
        .group_by(Offer.status)).all())
    allocs = db.execute(select(Allocation, Donation.effective_deadline).join(Donation)
                        .where(Allocation.receiver_id == receiver_id)).all()
    counted = [(a, dl) for a, dl in allocs if a.status in ("COLLECTED", "COMPLETED", "NO_SHOW")
               or (a.status == "CANCELLED" and a.cancelled_by == receiver_id)]
    on_time = sum(1 for a, dl in counted if a.collected_at is not None and a.collected_at <= dl)
    no_shows_30d = sum(1 for a, dl in counted if a.status == "NO_SHOW" and dl >= now - timedelta(days=30))
    avg = db.execute(select(func.avg(Feedback.overall_rating)).where(
        Feedback.to_user_id == receiver_id, Feedback.direction == "donor_to_receiver")).scalar_one()
    value = reliability_formula(accepted=offer_counts.get("ACCEPTED", 0), offers_total=sum(offer_counts.values()),
                                on_time=on_time, allocs_total=len(counted),
                                avg_rating=float(avg) if avg is not None else None, no_shows_30d=no_shows_30d)
    profile.reliability_score = _q(value)
    return profile.reliability_score


def recompute_quality(db: Session, donor_id: uuid.UUID) -> Decimal | None:
    profile = db.get(DonorProfile, donor_id)
    if profile is None:
        return None
    db.flush()
    now = now_utc()
    fbs = db.execute(select(Feedback).where(Feedback.to_user_id == donor_id,
                                            Feedback.direction == "receiver_to_donor")).scalars().all()
    avg = sum(f.overall_rating for f in fbs) / len(fbs) if fbs else None
    valid_90 = db.execute(select(func.count()).select_from(SafetyReport).where(
        SafetyReport.donor_id == donor_id, SafetyReport.status == "resolved_valid",
        SafetyReport.resolved_at >= now - timedelta(days=90))).scalar_one()
    value = quality_formula(avg_rating=avg, fresh_true=sum(1 for f in fbs if f.fresh_on_arrival), n=len(fbs),
                            valid_reports_90d=valid_90)
    profile.quality_score = _q(value)
    return profile.quality_score


def check_auto_suspension(db: Session, donor_id: uuid.UUID) -> bool:
    """2 safety reports resolved_valid within 30 days → Donor suspended, Admins notified (§13.2)."""
    now = now_utc()
    valid_30 = db.execute(select(func.count()).select_from(SafetyReport).where(
        SafetyReport.donor_id == donor_id, SafetyReport.status == "resolved_valid",
        SafetyReport.resolved_at >= now - timedelta(days=30))).scalar_one()
    user = db.get(User, donor_id)
    if valid_30 >= 2 and user and user.account_status != "suspended":
        before = user.account_status
        user.account_status = "suspended"
        write_audit(db, actor_id=None, action="user.suspended", entity_type="user", entity_id=donor_id,
                    before={"account_status": before}, after={"account_status": "suspended",
                                                              "reason": "2 valid safety reports in 30 days"})
        notif.notify_admins(db, "SAFETY_REPORT", "Donor auto-suspended",
                            "A donor was suspended after 2 valid safety reports in 30 days.",
                            "/admin/safety")
        return True
    return False
