"""Time helpers. Store UTC, compute in UTC, display IST (README D12)."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def now_utc() -> datetime:
    return datetime.now(UTC)


def to_ist(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(IST)


def today_ist(now: datetime | None = None) -> date:
    return to_ist(now or now_utc()).date()


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def fmt_ist(dt: datetime | None, pattern: str = "%d-%m-%Y %H:%M") -> str:
    return to_ist(dt).strftime(pattern) if dt else ""
