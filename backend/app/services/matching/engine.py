"""run_matching(donation_id, trigger) — ARCHITECTURE §7.1, §7.7, §7.8.

Holds a row lock on the donation (SELECT … FOR UPDATE) so two runs never overlap. All scoring is
delegated to the pure functions in ranking.py.
"""

import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Allocation, Donation, DonorProfile, MatchRun, Offer, ReceiverProfile, User
from app.services import notifications as notif
from app.services.app_config import get_config
from app.services.matching.ranking import batch_size, evaluate, offer_timeout_minutes
from app.services.matching.types import DonationCtx, ReceiverCtx
from app.services.priority import compute_priority
from app.services.state import apply_transition, init_status
from app.utils.time import IST, now_utc, today_ist

TRIGGERS = {"posted", "approved", "declined", "timed_out", "allocation_cancelled", "scheduler", "radius_widened"}


def lock_donation(db: Session, donation_id: uuid.UUID) -> Donation | None:
    return db.execute(
        select(Donation).where(Donation.id == donation_id).with_for_update().execution_options(populate_existing=True)
    ).scalar_one_or_none()


def held_servings_by_receiver(db: Session) -> dict[uuid.UUID, int]:
    rows = db.execute(
        select(Allocation.receiver_id, func.sum(Allocation.servings))
        .where(Allocation.status == "ACCEPTED")
        .group_by(Allocation.receiver_id)
    ).all()
    return {r: int(s or 0) for r, s in rows}


def capacity_available_for(db: Session, receiver_id: uuid.UUID) -> int:
    profile = db.get(ReceiverProfile, receiver_id)
    if profile is None:
        return 0
    held = db.execute(
        select(func.coalesce(func.sum(Allocation.servings), 0)).where(
            Allocation.receiver_id == receiver_id, Allocation.status == "ACCEPTED"
        )
    ).scalar_one()
    return profile.max_capacity_servings - int(held)


def _allocated_today(db: Session, now: datetime) -> dict[uuid.UUID, int]:
    start_ist = datetime.combine(today_ist(now), datetime.min.time(), tzinfo=IST)
    rows = db.execute(
        select(Allocation.receiver_id, func.sum(Allocation.servings))
        .where(Allocation.accepted_at >= start_ist, Allocation.status != "CANCELLED")
        .group_by(Allocation.receiver_id)
    ).all()
    return {r: int(s or 0) for r, s in rows}


def load_receivers(db: Session, donation_id: uuid.UUID, now: datetime) -> list[ReceiverCtx]:
    held = held_servings_by_receiver(db)
    today_alloc = _allocated_today(db, now)
    offered = set(db.execute(select(Offer.receiver_id).where(Offer.donation_id == donation_id)).scalars())
    rows = db.execute(
        select(ReceiverProfile, User).join(User, User.id == ReceiverProfile.user_id).where(User.role == "receiver")
    ).all()
    return [
        ReceiverCtx(
            receiver_id=p.user_id,
            org_name=p.org_name,
            role=u.role,
            account_status=u.account_status,
            verified_at=p.verified_at,
            is_available_now=p.is_available_now,
            operating_hours=p.operating_hours,
            diet_accepted=p.diet_accepted,
            accepted_categories=list(p.accepted_categories),
            lat=p.lat,
            lng=p.lng,
            service_radius_km=float(p.service_radius_km),
            max_capacity_servings=p.max_capacity_servings,
            held_servings=held.get(p.user_id, 0),
            meals_needed_today=p.meals_needed_today,
            meals_needed_set_on=p.meals_needed_set_on,
            allocated_today=today_alloc.get(p.user_id, 0),
            reliability_score=float(p.reliability_score),
            created_at=p.created_at,
            already_offered=p.user_id in offered,
        )
        for p, u in rows
    ]


def donation_ctx(d: Donation) -> DonationCtx:
    return DonationCtx(
        id=d.id,
        food_category=d.food_category,
        diet_type=d.diet_type,
        remaining_servings=d.remaining_servings,
        effective_deadline=d.effective_deadline,
        search_radius_km=float(d.search_radius_km),
        priority_level=d.priority_level,
        pickup_lat=d.pickup_lat,
        pickup_lng=d.pickup_lng,
    )


def pending_offer_count(db: Session, donation_id: uuid.UUID) -> int:
    return db.execute(
        select(func.count()).select_from(Offer).where(Offer.donation_id == donation_id, Offer.status == "PENDING")
    ).scalar_one()


def maybe_no_match_alert(db: Session, d: Donation, *, zero_at_max: bool, now: datetime) -> None:
    """Send NO_MATCH_ALERT once to Donor + all Admins (§7.8)."""
    if d.no_match_alerted_at is not None or d.remaining_servings <= 0:
        return
    time_left_min = (d.effective_deadline - now).total_seconds() / 60
    if not (zero_at_max or time_left_min < 30):
        return
    d.no_match_alerted_at = now
    title = "No Receiver found yet"
    body = f'We couldn\'t find a Receiver for "{d.title}" ({d.remaining_servings} servings) yet.'
    notif.notify(db, d.donor_id, "NO_MATCH_ALERT", title, body, f"/donor/donations/{d.id}")
    notif.notify_admins(db, "NO_MATCH_ALERT", title, body + " You can assign one manually.", f"/admin/donations/{d.id}")


def run_matching(
    db: Session, donation_id: uuid.UUID, trigger: str, *, now: datetime | None = None, _depth: int = 0
) -> MatchRun | None:
    assert trigger in TRIGGERS, trigger
    now = now or now_utc()
    cfg = get_config(db)
    d = lock_donation(db, donation_id)
    if d is None or d.status not in ("POSTED", "MATCHED") or d.remaining_servings <= 0:
        return None
    if d.effective_deadline <= now:
        return None
    if trigger != "radius_widened" and pending_offer_count(db, d.id) > 0:
        return None  # wait for pending offers to resolve

    prio = compute_priority(
        effective_deadline=d.effective_deadline,
        remaining_servings=d.remaining_servings,
        food_category=d.food_category,
        now=now,
        cfg=cfg,
    )
    d.priority_score, d.priority_level = prio.stored_score, prio.level

    receivers = load_receivers(db, d.id, now)
    weights, candidates = evaluate(donation_ctx(d), receivers, now=now, today_ist=today_ist(now), cfg=cfg)
    run = MatchRun(
        donation_id=d.id,
        trigger=trigger,
        search_radius_km=d.search_radius_km,
        remaining_servings=d.remaining_servings,
        weights=dict(weights),
        candidates=[c.to_json() for c in candidates],
    )
    db.add(run)
    db.flush()

    included = [c for c in candidates if c.included]
    if not included:
        steps = [Decimal(str(s)) for s in cfg["search_radius_steps_km"]]
        larger = [s for s in steps if s > d.search_radius_km]
        if larger and _depth < len(steps):
            d.search_radius_km = larger[0]
            db.flush()
            return run_matching(db, d.id, "radius_widened", now=now, _depth=_depth + 1)
        maybe_no_match_alert(db, d, zero_at_max=True, now=now)
        return run

    timeout = offer_timeout_minutes(d.effective_deadline, now, cfg)
    expires_at = min(now + timedelta(minutes=timeout), d.effective_deadline)
    donor_name = db.get(DonorProfile, d.donor_id)
    for cand in included[: batch_size(d.priority_level, cfg)]:
        offer = Offer(
            donation_id=d.id,
            receiver_id=cand.receiver_id,
            match_run_id=run.id,
            rank=cand.rank,
            match_score=cand.match_score,
            factor_scores={k: round(v, 4) for k, v in cand.factors.items()},
            reasons=cand.reasons,
            distance_km=Decimal(str(cand.distance_km)),
            eta_minutes=cand.eta_minutes,
            offered_servings=min(cand.capacity_available, d.remaining_servings),
            offered_at=now,
            expires_at=expires_at,
        )
        init_status(db, offer, "offer", "PENDING", actor_id=None, extra={"match_run_id": str(run.id)})
        notif.notify(
            db,
            cand.receiver_id,
            "OFFER_RECEIVED",
            "New food offer",
            f'{offer.offered_servings} servings of "{d.title}" from '
            f"{donor_name.org_name if donor_name else 'a donor'} · match {cand.match_score}%",
            f"/receiver/offers/{offer.id}",
        )
    if d.status == "POSTED":
        apply_transition(db, d, "donation", "MATCHED", actor_id=None, extra={"trigger": trigger})
    maybe_no_match_alert(db, d, zero_at_max=False, now=now)
    return run
