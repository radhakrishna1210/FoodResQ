"""State machines — ARCHITECTURE §5. All status changes go through apply_transition().

Any transition not listed raises InvalidTransition (HTTP 409). Every applied transition writes an
audit_log row (README rule 6).
"""

import uuid
from typing import Literal

from sqlalchemy.orm import Session

from app.errors import InvalidTransition
from app.services.audit import write_audit
from app.utils.time import now_utc

Entity = Literal["donation", "offer", "allocation"]

DONATION_TRANSITIONS: dict[str | None, set[str]] = {
    None: {"POSTED", "FLAGGED"},
    "FLAGGED": {"POSTED", "CANCELLED", "EXPIRED"},
    "POSTED": {"MATCHED", "ACCEPTED", "EXPIRED", "CANCELLED"},
    "MATCHED": {"POSTED", "ACCEPTED", "EXPIRED", "CANCELLED"},
    "ACCEPTED": {"POSTED", "COLLECTED", "EXPIRED", "CANCELLED"},
    "COLLECTED": {"COMPLETED"},
    "COMPLETED": set(),
    "EXPIRED": set(),
    "CANCELLED": set(),
}

OFFER_TRANSITIONS: dict[str | None, set[str]] = {
    None: {"PENDING"},
    "PENDING": {"ACCEPTED", "DECLINED", "TIMED_OUT", "SUPERSEDED", "WITHDRAWN"},
    "ACCEPTED": set(),
    "DECLINED": set(),
    "TIMED_OUT": set(),
    "SUPERSEDED": set(),
    "WITHDRAWN": set(),
}

ALLOCATION_TRANSITIONS: dict[str | None, set[str]] = {
    None: {"ACCEPTED"},
    "ACCEPTED": {"COLLECTED", "CANCELLED", "NO_SHOW"},
    "COLLECTED": {"COMPLETED"},
    "COMPLETED": set(),
    "NO_SHOW": set(),
    "CANCELLED": set(),
}

TABLES: dict[str, dict[str | None, set[str]]] = {
    "donation": DONATION_TRANSITIONS,
    "offer": OFFER_TRANSITIONS,
    "allocation": ALLOCATION_TRANSITIONS,
}


def can_transition(entity: Entity, from_status: str | None, to_status: str) -> bool:
    return to_status in TABLES[entity].get(from_status, set())


def assert_transition(entity: Entity, from_status: str | None, to_status: str) -> None:
    if not can_transition(entity, from_status, to_status):
        raise InvalidTransition(f"Cannot change {entity} from {from_status or 'new'} to {to_status}.",
                                details={"entity": entity, "from": from_status, "to": to_status})


def apply_transition(db: Session, obj, entity: Entity, to_status: str, *, actor_id: uuid.UUID | None,
                     reason: str | None = None, extra: dict | None = None) -> None:
    """Validate and apply a status change on a model instance, then audit it."""
    from_status = getattr(obj, "status", None)
    assert_transition(entity, from_status, to_status)
    obj.status = to_status
    if hasattr(obj, "updated_at"):
        obj.updated_at = now_utc()
    after = {"status": to_status}
    if reason:
        after["reason"] = reason
    if extra:
        after.update(extra)
    db.flush()
    write_audit(db, actor_id=actor_id, action=f"{entity}.status_changed", entity_type=entity, entity_id=obj.id,
                before={"status": from_status}, after=after)


def init_status(db: Session, obj, entity: Entity, status: str, *, actor_id: uuid.UUID | None,
                extra: dict | None = None) -> None:
    """Initial status for a new row (transition from None)."""
    assert_transition(entity, None, status)
    obj.status = status
    db.add(obj)
    db.flush()
    write_audit(db, actor_id=actor_id, action=f"{entity}.status_changed", entity_type=entity, entity_id=obj.id,
                before={"status": None}, after={"status": status, **(extra or {})})
