"""Donor endpoints — ARCHITECTURE §10.2."""

import uuid

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_active_role, require_role
from app.db import get_db
from app.errors import NotFound
from app.models import Donation, User
from app.routers.common import paginate
from app.schemas.requests import DonationIn, DonorProfilePatch, HandoverIn, ReasonIn
from app.services import accounts, allocations, donations, jobs, ratelimit, records
from app.services.views import allocation_dict, donation_detail, donation_summary
from app.utils.serialize import page as page_out
from app.utils.serialize import to_dict

router = APIRouter(tags=["donor"])
donor_any = require_role("donor")
donor_active = require_active_role("donor")


@router.get("/donor/profile")
def get_profile(user: User = Depends(donor_any), db: Session = Depends(get_db)):
    from app.models import DonorProfile

    return to_dict(db.get(DonorProfile, user.id))


@router.patch("/donor/profile")
def patch_profile(body: DonorProfilePatch, user: User = Depends(donor_any), db: Session = Depends(get_db)):
    return to_dict(accounts.update_donor_profile(db, user, body.model_dump(exclude_unset=True)))


@router.post("/donations", status_code=201)
def create(body: DonationIn, user: User = Depends(donor_active), db: Session = Depends(get_db)):
    ratelimit.check("donation_create", str(user.id))
    d = donations.create_donation(db, user, body.model_dump())
    db.commit()
    return donation_detail(db, d, user)


@router.get("/donations")
def list_mine(status: str | None = None, page: int = 1, page_size: int = Query(20, le=100),
              user: User = Depends(donor_any), db: Session = Depends(get_db)):
    stmt = select(Donation).where(Donation.donor_id == user.id)
    if status:
        stmt = stmt.where(Donation.status.in_(status.split(",")))
    rows, p, ps, total = paginate(db, stmt.order_by(Donation.posted_at.desc()), page, page_size)
    for d in rows:
        jobs.lazy_check_donation(db, d.id)
    return page_out([donation_summary(db, d) for d in rows], p, ps, total)


@router.get("/donations/{donation_id}")
def detail(donation_id: uuid.UUID, user: User = Depends(donor_any), db: Session = Depends(get_db)):
    donations.get_owned_donation(db, donation_id, user)
    jobs.lazy_check_donation(db, donation_id)
    return donation_detail(db, db.get(Donation, donation_id), user)


@router.post("/donations/{donation_id}/cancel")
def cancel(donation_id: uuid.UUID, body: ReasonIn, user: User = Depends(donor_any), db: Session = Depends(get_db)):
    d = donations.cancel_donation(db, donation_id, user, body.reason)
    return donation_detail(db, d, user)


@router.post("/allocations/{allocation_id}/handover")
def handover(allocation_id: uuid.UUID, body: HandoverIn, user: User = Depends(donor_any),
             db: Session = Depends(get_db)):
    a = allocations.handover(db, allocation_id, user, body.code)
    return allocation_dict(db, a, user)


@router.get("/donations/{donation_id}/record.csv")
def record_csv(donation_id: uuid.UUID, user: User = Depends(donor_any), db: Session = Depends(get_db)):
    d = db.get(Donation, donation_id)
    if d is None or d.donor_id != user.id:
        raise NotFound("Donation not found.")
    body = records.to_csv(records.rows_for_donation(db, donation_id))
    return Response(content=body, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="foodresq-record-{donation_id}.csv"'})
