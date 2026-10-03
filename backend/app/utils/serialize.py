"""Model → JSON-safe dict. snake_case, ISO 8601 UTC with Z (ARCHITECTURE §17)."""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import inspect


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def jsonable(v: Any) -> Any:
    if isinstance(v, datetime):
        return iso(v)
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, dict):
        return {k: jsonable(x) for k, x in v.items()}
    if isinstance(v, list | tuple):
        return [jsonable(x) for x in v]
    return v


def to_dict(obj, exclude: set[str] | None = None) -> dict[str, Any]:
    exclude = exclude or set()
    return {c.key: jsonable(getattr(obj, c.key)) for c in inspect(obj).mapper.column_attrs if c.key not in exclude}


def page(items: list, page_no: int, page_size: int, total: int) -> dict[str, Any]:
    return {"items": items, "page": page_no, "page_size": page_size, "total": total}
