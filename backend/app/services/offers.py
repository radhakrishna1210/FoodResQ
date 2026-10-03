"""Offers — accept (concurrency-safe, §7.9), decline / timeout with cascade (§7.10)."""

import secrets
import uuid
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import Conflict, NotFound, ValidationFailed
from app.models import Allocation, Offer, ReceiverProfile, User
from app.services import notifications as notif
from app.services import trust
from app.services.matching.engine import (
    capacity_available_for,
    lock_donation,
    pending_offer_count,
    run_matching,
)
from app.services.state import apply_transition, init_status
from app.utils.time import fmt_ist, now_utc

DECLINE_REASONS = {"no_capacity", "too_far", "no_vehicle_now", "food_type", "other"}


def new_handover_code() -> str:
    return f"{secrets.randbelow(10000):04d}"


def get_owned_offer(db: Session, offer_id: uuid.UUID, receiver: User) -> Offer:
    o = db.get(Offer, offer_id)
    if o is None or o.receiver_id != receiver.id:
        raise NotFound("Offer not found.")
    return o


def accept(db: Session, offer_id: uuid.UUID, receiver: User, *, now: datetime | None = None) -> Allocation:
    now = now or now_utc()
    pre = db.get(Offer, offer_id)
    if pre is None or pre.receiver_id != receiver.id:
        raise NotFound("Offer not found.")
    # Lock order: donation first, then offer (§7.9)
    d = lock_donation(db, pre.donation_id)
    o = db.execute(
        select(Offer).where(Offer.id == offer_id).with_for_update().execution_options(populate_existing=True)
    ).scalar_one()
    if o.receiver_id != receiver.id:
        raise NotFound("Offer not found.")
    if o.status != "PENDING" or now > o.expires_at:
        raise Conflict(
            "Another Receiver has already taken this food."
            if o.status == "SUPERSEDED"
            else "This offer is no longer available.",
            code="OFFER_NOT_AVAILABLE",
        )
    if d is None or d.status not in ("POSTED", "MATCHED") or d.remaining_servings <= 0:
        raise Conflict("Another Receiver has already taken this food.", code="DONATION_NOT_AVAILABLE")
    servings = min(o.offered_servings, d.remaining_servings, capacity_available_for(db, receiver.id))
    if servings < 1:
        raise Conflict("You don't have capacity left for this food.", code="NO_CAPACITY")

    alloc = Allocation(
        donation_id=d.id,
        receiver_id=receiver.id,
        offer_id=o.id,
        servings=servings,
        handover_code=new_handover_code(),
        accepted_at=now,
        eta_at=now + timedelta(minutes=o.eta_minutes),
    )
    init_status(db, alloc, "allocation", "ACCEPTED", actor_id=receiver.id, extra={"servings": servings})
    o.responded_at = now
    apply_transition(db, o, "offer", "ACCEPTED", actor_id=receiver.id)
    d.remaining_servings -= servings

    others = (
        db.execute(
            select(Offer)
            .where(Offer.donation_id == d.id, Offer.status == "PENDING")
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        .scalars()
        .all()
    )
    rematch = False
    if d.remaining_servings == 0:
        for other in others:
            apply_transition(db, other, "offer", "SUPERSEDED", actor_id=None)
            notif.notify(
                db,
                other.receiver_id,
                "OFFER_SUPERSEDED",
                "Offer taken",
                "This food was taken by another Receiver.",
                f"/receiver/offers/{other.id}",
            )
        apply_transition(db, d, "donation", "ACCEPTED", actor_id=None)
    else:
        for other in others:
            other.offered_servings = max(1, min(capacity_available_for(db, other.receiver_id), d.remaining_servings))
        if not others:
            if d.status == "MATCHED":
                apply_transition(db, d, "donation", "POSTED", actor_id=None)
            rematch = True

    rp = db.get(ReceiverProfile, receiver.id)
    notif.notify(
        db,
        d.donor_id,
        "OFFER_ACCEPTED",
        "Receiver accepted",
        f"{rp.org_name if rp else 'A Receiver'} accepted {servings} servings. "
        f"ETA about {fmt_ist(alloc.eta_at, '%I:%M %p').lstrip('0')}.",
        f"/donor/donations/{d.id}",
    )
    trust.recompute_reliability(db, receiver.id)
    db.flush()
    if rematch:
        run_matching(db, d.id, "declined", now=now)  # TODO(team): no dedicated trigger for partial accept
    return alloc


def decline(
    db: Session,
    offer_id: uuid.UUID,
    receiver: User,
    reason_code: str,
    note: str | None = None,
    *,
    now: datetime | None = None,
) -> Offer:
    now = now or now_utc()
    if reason_code not in DECLINE_REASONS:
        raise ValidationFailed("Please pick a reason.", details={"fields": {"reason_code": "Invalid reason."}})
    pre = get_owned_offer(db, offer_id, receiver)
    d = lock_donation(db, pre.donation_id)
    o = db.execute(
        select(Offer).where(Offer.id == offer_id).with_for_update().execution_options(populate_existing=True)
    ).scalar_one()
    if o.status != "PENDING":
        raise Conflict("This offer is no longer available.", code="OFFER_NOT_AVAILABLE")
    o.responded_at = now
    o.decline_reason = reason_code if not note else f"{reason_code}: {note[:300]}"
    apply_transition(db, o, "offer", "DECLINED", actor_id=receiver.id, reason=reason_code)
    notif.notify(
        db,
        d.donor_id,
        "OFFER_DECLINED",
        "Offer declined",
        "A Receiver couldn't take this food. We're finding the next best match.",
        f"/donor/donations/{d.id}",
    )
    trust.recompute_reliability(db, receiver.id)
    _cascade_if_no_pending(db, d, "declined", now)
    return o


def time_out(db: Session, o: Offer, now: datetime) -> bool:
    """PENDING offer past expires_at → TIMED_OUT; cascade if needed. Idempotent."""
    if o.status != "PENDING" or now <= o.expires_at:
        return False
    d = lock_donation(db, o.donation_id)
    if o.status != "PENDING":
        return False
    apply_transition(db, o, "offer", "TIMED_OUT", actor_id=None)
    notif.notify(
        db,
        o.receiver_id,
        "OFFER_TIMED_OUT",
        "Offer expired",
        "You didn't respond in time, so this offer moved to the next Receiver.",
        f"/receiver/offers/{o.id}",
    )
    trust.recompute_reliability(db, o.receiver_id)
    _cascade_if_no_pending(db, d, "timed_out", now)
    return True


def _cascade_if_no_pending(db: Session, d, trigger: str, now: datetime) -> None:
    db.flush()
    if d.status == "MATCHED" and pending_offer_count(db, d.id) == 0 and d.remaining_servings > 0:
        apply_transition(db, d, "donation", "POSTED", actor_id=None, extra={"trigger": trigger})
        db.flush()
        run_matching(db, d.id, trigger, now=now)
