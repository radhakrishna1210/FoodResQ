"""Shared endpoints — ARCHITECTURE §10.4."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_role
from app.db import get_db
from app.models import Notification, User
from app.routers.common import paginate
from app.schemas.requests import DisputeIn, FeedbackIn, MessageIn, NotificationsReadIn, UploadSignIn
from app.services import allocations, feedback, impact, jobs, messaging, ratelimit, uploads
from app.services.views import allocation_dict, feedback_dict
from app.utils.serialize import page as page_out
from app.utils.serialize import to_dict
from app.utils.time import now_utc

router = APIRouter(tags=["shared"])
party = require_role("donor", "receiver", "admin")


@router.get("/allocations/{allocation_id}")
def get_allocation(allocation_id: uuid.UUID, user: User = Depends(party), db: Session = Depends(get_db)):
    a, d = allocations.get_for_party(db, allocation_id, user)
    jobs.lazy_check_donation(db, d.id)
    db.refresh(a)
    return allocation_dict(db, a, user, d)


@router.get("/allocations/{allocation_id}/messages")
def get_messages(allocation_id: uuid.UUID, user: User = Depends(party), db: Session = Depends(get_db)):
    msgs = messaging.list_messages(db, allocation_id, user)
    a, _ = allocations.get_for_party(db, allocation_id, user)
    return {"items": [to_dict(m) for m in msgs], "open": messaging.chat_open(a)}


@router.post("/allocations/{allocation_id}/messages", status_code=201)
def post_message(allocation_id: uuid.UUID, body: MessageIn, user: User = Depends(party),
                 db: Session = Depends(get_db)):
    ratelimit.check("messages", str(user.id))
    return to_dict(messaging.send_message(db, allocation_id, user, body.body))


@router.post("/allocations/{allocation_id}/feedback", status_code=201)
def post_feedback(allocation_id: uuid.UUID, body: FeedbackIn, user: User = Depends(party),
                  db: Session = Depends(get_db)):
    return to_dict(feedback.submit(db, allocation_id, user, body.model_dump()))


@router.get("/allocations/{allocation_id}/feedback")
def get_feedback(allocation_id: uuid.UUID, user: User = Depends(party), db: Session = Depends(get_db)):
    v = feedback.visible(db, allocation_id, user)
    if v["all"] is not None:
        return {"items": [to_dict(f) for f in v["all"]], "window_closed": v["window_closed"]}
    return {"mine": feedback_dict(v["mine"]), "theirs": feedback_dict(v["theirs"]),
            "theirs_submitted": v["theirs_submitted"], "window_closed": v["window_closed"]}


@router.post("/allocations/{allocation_id}/dispute", status_code=201)
def post_dispute(allocation_id: uuid.UUID, body: DisputeIn, user: User = Depends(party),
                 db: Session = Depends(get_db)):
    return to_dict(feedback.open_dispute(db, allocation_id, user, body.reason, body.description))


@router.get("/notifications")
def list_notifications(unread: bool | None = None, page: int = 1, page_size: int = Query(20, le=100),
                       user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread:
        stmt = stmt.where(Notification.read_at.is_(None))
    rows, p, ps, total = paginate(db, stmt.order_by(Notification.created_at.desc()), page, page_size)
    out = page_out([to_dict(n) for n in rows], p, ps, total)
    out["unread_count"] = len(db.execute(select(Notification.id).where(
        Notification.user_id == user.id, Notification.read_at.is_(None))).all())
    return out


@router.post("/notifications/read")
def read_notifications(body: NotificationsReadIn, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    stmt = update(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
    if not body.all:
        stmt = stmt.where(Notification.id.in_(body.ids or []))
    res = db.execute(stmt.values(read_at=now_utc()))
    return {"updated": res.rowcount}


@router.post("/uploads/sign")
def sign_upload(body: UploadSignIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scope = None
    if body.bucket == "feedback-photos" and body.allocation_id:
        a, d = allocations.get_for_party(db, body.allocation_id, user)
        allocations.ensure_party(a, d, user)
        scope = a.id
    return uploads.sign_upload(user, body.bucket, body.content_type, scope)


@router.get("/impact/me")
def impact_me(user: User = Depends(require_role("donor", "receiver")), db: Session = Depends(get_db)):
    return impact.impact_for_user(db, user)


@router.get("/impact/public")
def impact_public(db: Session = Depends(get_db)):
    return impact.public_impact(db)
