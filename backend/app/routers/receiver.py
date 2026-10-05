"""Receiver endpoints — ARCHITECTURE §10.3."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_active_role, require_role
from app.db import get_db
from app.models import Allocation, Offer, ReceiverProfile, User
from app.routers.common import paginate
from app.schemas.requests import (
    AvailabilityIn,
    CompleteIn,
    DeclineIn,
    NeedsIn,
    ReasonIn,
    ReceiverProfilePatch,
)
from app.services import accounts, allocations, jobs, nearby, offers
from app.services.views import allocation_dict, offer_dict
from app.utils.serialize import page as page_out
from app.utils.serialize import to_dict

router = APIRouter(tags=["receiver"])
receiver_any = require_role("receiver")
receiver_active = require_active_role("receiver")


@router.get("/receiver/profile")
def get_profile(user: User = Depends(receiver_any), db: Session = Depends(get_db)):
    return to_dict(db.get(ReceiverProfile, user.id))


@router.patch("/receiver/profile")
def patch_profile(body: ReceiverProfilePatch, user: User = Depends(receiver_any), db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    p = accounts.update_receiver_profile(db, user, data)
    return {**to_dict(p), "account_status": user.account_status}


@router.patch("/receiver/availability")
def availability(body: AvailabilityIn, user: User = Depends(receiver_any), db: Session = Depends(get_db)):
    return to_dict(accounts.set_availability(db, user, body.is_available_now))


@router.patch("/receiver/needs")
def needs(body: NeedsIn, user: User = Depends(receiver_any), db: Session = Depends(get_db)):
    return to_dict(accounts.set_needs(db, user, body.meals_needed_today))


@router.get("/offers")
def list_offers(status: str | None = "PENDING", page: int = 1, page_size: int = Query(20, le=100),
                user: User = Depends(receiver_active), db: Session = Depends(get_db)):
    for oid in db.execute(select(Offer.id).where(Offer.receiver_id == user.id, Offer.status == "PENDING")).scalars():
        jobs.lazy_check_donation(db, db.get(Offer, oid).donation_id)
    stmt = select(Offer).where(Offer.receiver_id == user.id)
    if status:
        stmt = stmt.where(Offer.status.in_(status.split(",")))
    rows, p, ps, total = paginate(db, stmt.order_by(Offer.expires_at), page, page_size)
    return page_out([offer_dict(db, o) for o in rows], p, ps, total)


@router.get("/receiver/nearby-donations")
def nearby_donations(user: User = Depends(receiver_active), db: Session = Depends(get_db)):
    """Open donations this Receiver could take (read-only feed; only top-ranked Receivers get offers)."""
    return {"items": [to_dict(x) for x in nearby.nearby_donations(db, user)]}


@router.get("/offers/{offer_id}")
def get_offer(offer_id: uuid.UUID, user: User = Depends(receiver_active), db: Session = Depends(get_db)):
    o = offers.get_owned_offer(db, offer_id, user)
    jobs.lazy_check_donation(db, o.donation_id)
    db.refresh(o)
    return offer_dict(db, o)


@router.post("/offers/{offer_id}/accept")
def accept(offer_id: uuid.UUID, user: User = Depends(receiver_active), db: Session = Depends(get_db)):
    a = offers.accept(db, offer_id, user)
    return allocation_dict(db, a, user)


@router.post("/offers/{offer_id}/decline")
def decline(offer_id: uuid.UUID, body: DeclineIn, user: User = Depends(receiver_active),
            db: Session = Depends(get_db)):
    return offer_dict(db, offers.decline(db, offer_id, user, body.reason_code, body.note))


@router.get("/allocations")
def list_allocations(status: str | None = None, page: int = 1, page_size: int = Query(20, le=100),
                     user: User = Depends(receiver_any), db: Session = Depends(get_db)):
    stmt = select(Allocation).where(Allocation.receiver_id == user.id)
    if status:
        stmt = stmt.where(Allocation.status.in_(status.split(",")))
    rows, p, ps, total = paginate(db, stmt.order_by(Allocation.accepted_at.desc()), page, page_size)
    return page_out([allocation_dict(db, a, user) for a in rows], p, ps, total)


@router.post("/allocations/{allocation_id}/cancel")
def cancel(allocation_id: uuid.UUID, body: ReasonIn, user: User = Depends(receiver_active),
           db: Session = Depends(get_db)):
    return allocation_dict(db, allocations.receiver_cancel(db, allocation_id, user, body.reason), user)


@router.post("/allocations/{allocation_id}/complete")
def complete(allocation_id: uuid.UUID, body: CompleteIn, user: User = Depends(receiver_active),
             db: Session = Depends(get_db)):
    a = allocations.complete(db, allocation_id, user, body.servings_distributed, body.distribution_area)
    return allocation_dict(db, a, user)
