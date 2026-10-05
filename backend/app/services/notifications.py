"""Notifications — ARCHITECTURE §8. In-app only in the MVP (email is Phase 2)."""

import uuid
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification, User
from app.services import realtime

TYPES = {
    "VERIFICATION_RESULT", "DONATION_FLAGGED", "DONATION_APPROVED", "DONATION_REJECTED", "OFFER_RECEIVED",
    "OFFER_SUPERSEDED", "OFFER_TIMED_OUT", "OFFER_ACCEPTED", "OFFER_DECLINED", "NO_MATCH_ALERT",
    "PICKUP_REMINDER", "HANDOVER_LOCKED", "COLLECTED", "COMPLETED", "FEEDBACK_REQUEST", "ALLOCATION_CANCELLED",
    "DONATION_CANCELLED", "DONATION_EXPIRED", "NO_SHOW", "NEW_MESSAGE", "SAFETY_REPORT", "DISPUTE_OPENED",
    "DISPUTE_RESOLVED",
}


def notify(db: Session, user_id: uuid.UUID, type_: str, title: str, body: str, link: str | None = None) -> None:
    assert type_ in TYPES, type_
    db.add(Notification(user_id=user_id, type=type_, title=title, body=body, link=link))
    realtime.ping_user(user_id)


def notify_many(db: Session, user_ids: Iterable[uuid.UUID], type_: str, title: str, body: str,
                link: str | None = None) -> None:
    for uid in set(user_ids):
        notify(db, uid, type_, title, body, link)


def admin_ids(db: Session) -> list[uuid.UUID]:
    return list(db.execute(select(User.id).where(User.role == "admin", User.account_status == "active")).scalars())


def notify_admins(db: Session, type_: str, title: str, body: str, link: str | None = None) -> None:
    notify_many(db, admin_ids(db), type_, title, body, link)
