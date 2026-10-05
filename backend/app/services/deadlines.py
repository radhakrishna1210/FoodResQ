"""Safe pickup deadline — ARCHITECTURE §6.2. Pure functions."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

from app.utils.time import IST


@dataclass(frozen=True)
class Deadlines:
    safe_pickup_deadline: datetime
    effective_deadline: datetime
    last_consumption_at: datetime  # FSSAI label "Last time of consumption"


def safe_window_hours(storage_condition: str, ambient_above_32c: bool, cfg: dict[str, Any]) -> float:
    windows = cfg["safe_window_hours"]
    if storage_condition == "room_temp":
        return windows["room_temp_hot_ambient"] if ambient_above_32c else windows["room_temp"]
    return windows[storage_condition]


def packaged_expiry_end(expiry: date) -> datetime:
    """packaged_expiry_date at 23:59 IST."""
    return datetime.combine(expiry, time(23, 59), tzinfo=IST)


def compute_deadlines(*, storage_condition: str, ambient_above_32c: bool, prepared_at: datetime,
                      packaged_expiry_date: date | None, donor_pickup_by: datetime,
                      cfg: dict[str, Any]) -> Deadlines:
    if storage_condition == "packaged_sealed":
        if packaged_expiry_date is None:
            raise ValueError("packaged_expiry_date required for packaged_sealed")
        expiry_end = packaged_expiry_end(packaged_expiry_date)
        safe = expiry_end - timedelta(hours=cfg["packaged_expiry_buffer_hours"])
        last_consumption = expiry_end
    else:
        safe = prepared_at + timedelta(hours=safe_window_hours(storage_condition, ambient_above_32c, cfg))
        last_consumption = safe + timedelta(hours=cfg["post_pickup_consume_hours"])
    return Deadlines(
        safe_pickup_deadline=safe,
        effective_deadline=min(donor_pickup_by, safe),
        last_consumption_at=last_consumption,
    )
