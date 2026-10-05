"""Per-allocation Donor ↔ Receiver chat (plain messaging, no AI). README §4.1, ARCHITECTURE §10.4."""

import uuid
from datetime import timedelta

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.errors import Conflict, ValidationFailed
from app.models import Message, Notification, User
from app.services import notifications as notif
from app.services import realtime
from app.services.allocations import ensure_party, get_for_party
from app.utils.time import now_utc


def list_messages(db: Session, allocation_id: uuid.UUID, user: User) -> list[Message]:
    a, d = get_for_party(db, allocation_id, user)
    if user.role != "admin":
        ensure_party(a, d, user)
    return list(db.execute(select(Message).where(Message.allocation_id == a.id)
                           .order_by(Message.created_at)).scalars())


def chat_open(a) -> bool:
    if a.status in ("ACCEPTED", "COLLECTED"):
        return True
    return a.status == "COMPLETED" and a.completed_at is not None and \
        now_utc() - a.completed_at < timedelta(hours=24)


def send_message(db: Session, allocation_id: uuid.UUID, user: User, body: str) -> Message:
    a, d = get_for_party(db, allocation_id, user)
    side = ensure_party(a, d, user)
    body = (body or "").strip()
    if not 1 <= len(body) <= 1000:
        raise ValidationFailed("Message must be 1–1000 characters.", details={"fields": {"body": "1–1000 chars"}})
    if not chat_open(a):
        raise Conflict("This chat is closed.", code="CHAT_CLOSED")
    msg = Message(allocation_id=a.id, sender_id=user.id, body=body)
    db.add(msg)
    other = d.donor_id if side == "receiver" else a.receiver_id
    link = f"/receiver/pickups/{a.id}" if side == "donor" else f"/donor/donations/{d.id}"
    # Max one NEW_MESSAGE notification per 2 min per allocation
    recent = db.execute(select(exists().where(
        Notification.user_id == other, Notification.type == "NEW_MESSAGE", Notification.link == link,
        Notification.created_at > now_utc() - timedelta(minutes=2)))).scalar()
    if not recent:
        notif.notify(db, other, "NEW_MESSAGE", "New message", body[:120], link)
    else:
        # notif.notify() already pings; this covers messages inside the 2-min notification throttle
        # so the chat window itself still updates live rather than waiting on the rate limit.
        realtime.ping_user(other)
    db.flush()
    return msg
