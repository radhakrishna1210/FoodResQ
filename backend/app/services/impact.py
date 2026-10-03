"""Impact (per user + public) and Admin analytics — ARCHITECTURE §14.2–14.3."""

import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Allocation, Donation, Feedback, Offer, ReceiverProfile, User
from app.utils.time import now_utc, to_ist


def _avg_minutes(pairs: list[tuple[datetime, datetime]]) -> float | None:
    if not pairs:
        return None
    return round(sum((a - p).total_seconds() for a, p in pairs) / len(pairs) / 60, 1)


def impact_for_user(db: Session, user: User) -> dict[str, Any]:
    q = select(Allocation, Donation).join(Donation, Donation.id == Allocation.donation_id)
    q = q.where(Donation.donor_id == user.id) if user.role == "donor" else q.where(Allocation.receiver_id == user.id)
    rows = db.execute(q).all()
    rescued = sum(a.servings for a, _ in rows if a.status in ("COLLECTED", "COMPLETED"))
    completed = sum(1 for a, _ in rows if a.status == "COMPLETED")
    avg = _avg_minutes([(a.accepted_at, d.posted_at) for a, d in rows if a.offer_id is not None])
    out: dict[str, Any] = {
        "meals_rescued": rescued,
        "successful_rescues": completed,
        "avg_time_to_acceptance_minutes": avg,
    }
    if user.role == "receiver":
        counted = [(a, d) for a, d in rows if a.status in ("COLLECTED", "COMPLETED", "NO_SHOW")]
        on_time = sum(1 for a, d in counted if a.collected_at and a.collected_at <= d.effective_deadline)
        out["on_time_pickup_rate"] = round(on_time / len(counted), 3) if counted else None
        rp = db.get(ReceiverProfile, user.id)
        out["reliability_score"] = float(rp.reliability_score) if rp else None
    if user.role == "donor":
        out["donations_posted"] = db.execute(
            select(func.count()).select_from(Donation).where(Donation.donor_id == user.id)
        ).scalar_one()
    return out


def public_impact(db: Session) -> dict[str, int]:
    rescued = db.execute(
        select(func.coalesce(func.sum(Allocation.servings), 0)).where(Allocation.status.in_(["COLLECTED", "COMPLETED"]))
    ).scalar_one()
    completed = db.execute(
        select(func.count()).select_from(Allocation).where(Allocation.status == "COMPLETED")
    ).scalar_one()
    receivers = db.execute(
        select(func.count())
        .select_from(ReceiverProfile)
        .join(User, User.id == ReceiverProfile.user_id)
        .where(User.account_status == "active", ReceiverProfile.verified_at.is_not(None))
    ).scalar_one()
    return {"meals_rescued": int(rescued), "rescues_completed": int(completed), "active_receivers": int(receivers)}


def analytics(db: Session, start: datetime, end: datetime) -> dict[str, Any]:
    donations = (
        db.execute(select(Donation).where(Donation.posted_at >= start, Donation.posted_at < end)).scalars().all()
    )
    d_ids = [d.id for d in donations]
    allocs = db.execute(select(Allocation).where(Allocation.donation_id.in_(d_ids))).scalars().all() if d_ids else []
    offers = db.execute(select(Offer).where(Offer.donation_id.in_(d_ids))).scalars().all() if d_ids else []
    posted_at = {d.id: d.posted_at for d in donations}
    total = len(donations)
    rescued = sum(a.servings for a in allocs if a.status in ("COLLECTED", "COMPLETED"))
    responded = [o for o in offers if o.status in ("ACCEPTED", "DECLINED", "TIMED_OUT")]
    fbs = (
        db.execute(
            select(Feedback).where(
                Feedback.direction == "receiver_to_donor", Feedback.allocation_id.in_([a.id for a in allocs])
            )
        )
        .scalars()
        .all()
        if allocs
        else []
    )
    fully = sum(
        1
        for d in donations
        if d.remaining_servings == 0 and d.expired_servings == 0 and d.status not in ("CANCELLED", "FLAGGED", "EXPIRED")
    )
    since_30 = now_utc() - timedelta(days=30)
    active_donors = db.execute(
        select(func.count(func.distinct(Donation.donor_id))).where(Donation.posted_at >= since_30)
    ).scalar_one()
    active_receivers = db.execute(
        select(func.count(func.distinct(Allocation.receiver_id))).where(Allocation.accepted_at >= since_30)
    ).scalar_one()

    per_day: dict[str, int] = defaultdict(int)
    day = to_ist(start).date()
    while day <= to_ist(end).date():
        per_day[day.isoformat()] = 0
        day += timedelta(days=1)
    for a in allocs:
        if a.status in ("COLLECTED", "COMPLETED"):
            per_day[to_ist(a.collected_at or a.accepted_at).date().isoformat()] += a.servings
    by_cat: dict[str, int] = defaultdict(int)
    for d in donations:
        by_cat[d.food_category] += 1

    return {
        "meals_rescued": rescued,
        "successful_rescues": sum(1 for a in allocs if a.status == "COMPLETED"),
        "donations_posted": total,
        "fully_matched_rate": round(fully / total, 3) if total else None,
        "expiry_rate": round(sum(1 for d in donations if d.status == "EXPIRED") / total, 3) if total else None,
        "avg_time_to_acceptance_minutes": _avg_minutes(
            [(a.accepted_at, posted_at[a.donation_id]) for a in allocs if a.offer_id is not None]
        ),
        "offer_acceptance_rate": round(sum(1 for o in responded if o.status == "ACCEPTED") / len(responded), 3)
        if responded
        else None,
        "no_show_count": sum(1 for a in allocs if a.status == "NO_SHOW"),
        "good_condition_rate": round(sum(1 for f in fbs if f.fresh_on_arrival) / len(fbs), 3) if fbs else None,
        "active_donors": active_donors,
        "active_receivers": active_receivers,
        "meals_per_day": [{"date": k, "meals": v} for k, v in sorted(per_day.items())],
        "donations_by_category": [{"food_category": k, "count": v} for k, v in sorted(by_cat.items())],
    }


def receiver_id_list(ids: list[uuid.UUID]) -> list[str]:
    return [str(i) for i in ids]
