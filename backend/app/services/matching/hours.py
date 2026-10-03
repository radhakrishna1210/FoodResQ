"""Operating hours (IST) — ARCHITECTURE §4.3.

Keys mon..sun; each null (closed) or {"open":"HH:MM","close":"HH:MM"}. close may be "24:00".
Overnight windows (close < open) run into the next day. Adjacent windows are merged so that
"00:00–24:00 every day" is one continuous interval.
"""

from datetime import datetime, time, timedelta

from app.utils.time import IST

DAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def _parse(hhmm: str) -> timedelta:
    h, m = hhmm.split(":")
    return timedelta(hours=int(h), minutes=int(m))


def _intervals(hours: dict, around: datetime) -> list[tuple[datetime, datetime]]:
    local = around.astimezone(IST)
    base = datetime.combine(local.date(), time(0), tzinfo=IST)
    spans: list[tuple[datetime, datetime]] = []
    for offset in range(-1, 3):
        day_start = base + timedelta(days=offset)
        window = hours.get(DAY_KEYS[day_start.weekday()])
        if not window:
            continue
        o, c = _parse(window["open"]), _parse(window["close"])
        if c <= o:  # overnight (or 00:00–00:00 treated as full day)
            c += timedelta(days=1)
        spans.append((day_start + o, day_start + c))
    spans.sort()
    merged: list[tuple[datetime, datetime]] = []
    for s, e in spans:
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    return merged


def is_open_at(hours: dict, at: datetime) -> bool:
    return any(s <= at < e for s, e in _intervals(hours, at))


def minutes_open_after(hours: dict, at: datetime) -> float:
    """Minutes the Receiver stays open after `at` (0 if closed). Capped by the lookahead (~2 days)."""
    for s, e in _intervals(hours, at):
        if s <= at < e:
            return (e - at).total_seconds() / 60
    return 0.0
