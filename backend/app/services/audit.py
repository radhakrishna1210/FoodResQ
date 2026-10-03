import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog


def _jsonable(v: Any) -> Any:
    if isinstance(v, dict):
        return {k: _jsonable(x) for k, x in v.items()}
    if isinstance(v, list | tuple):
        return [_jsonable(x) for x in v]
    if isinstance(v, str | int | float | bool) or v is None:
        return v
    return str(v)


def write_audit(db: Session, *, actor_id: uuid.UUID | None, action: str, entity_type: str, entity_id: uuid.UUID,
                before: dict | None = None, after: dict | None = None) -> None:
    db.add(AuditLog(actor_id=actor_id, action=action, entity_type=entity_type, entity_id=entity_id,
                    before=_jsonable(before), after=_jsonable(after)))
