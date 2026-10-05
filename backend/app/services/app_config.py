"""`app_config` defaults (ARCHITECTURE §16) and a cached accessor (refresh every 60 s or on Admin update)."""

import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

DEFAULT_CONFIG: dict[str, Any] = {
    "jev_weights_default": {"distance": 0.20, "capacity": 0.20, "feasibility": 0.15, "demand": 0.15,
                            "reliability": 0.10, "diet": 0.10, "availability": 0.10},
    "jev_weights_high": {"distance": 0.25, "capacity": 0.20, "feasibility": 0.20, "demand": 0.10,
                         "reliability": 0.10, "diet": 0.05, "availability": 0.10},
    "road_factor": 1.3,
    "avg_speed_kmph": 20,
    "prep_buffer_minutes": 15,
    "search_radius_steps_km": [10, 15, 20],
    # Hours after preparation within which the food must be picked up.
    "safe_window_hours": {"hot_held": 6, "room_temp": 6, "room_temp_hot_ambient": 6, "refrigerated": 12},
    # Packaged food must be picked up this many hours before its expiry.
    "packaged_expiry_buffer_hours": 18,
    # Every item must still be safe to eat this many hours after its pickup deadline.
    "post_pickup_consume_hours": 4,
    "min_rescue_window_minutes": 30,
    "offer_timeout_min_max": [5, 15],
    "offer_timeout_fraction": 0.10,
    "high_priority_batch_size": 2,
    "no_show_grace_minutes": 15,
    "feedback_window_hours": 24,
    "auto_complete_hours": 24,
    "priority_thresholds": {"high": 0.70, "medium": 0.40},
}

WEIGHT_KEYS = ("jev_weights_default", "jev_weights_high")
FACTOR_NAMES = ("distance", "capacity", "feasibility", "demand", "reliability", "diet", "availability")

_CACHE_TTL_S = 60
_cache: dict[str, Any] = {}
_cache_loaded_at: float = 0.0


def validate_weights(weights: dict[str, float]) -> None:
    """Server rejects weight sets that do not sum to 1.00 (±0.001). ARCHITECTURE §7.5."""
    from app.errors import ValidationFailed

    if set(weights) != set(FACTOR_NAMES):
        raise ValidationFailed("Weights must include exactly: " + ", ".join(FACTOR_NAMES))
    if any(float(v) < 0 for v in weights.values()):
        raise ValidationFailed("Weights cannot be negative.")
    total = sum(float(v) for v in weights.values())
    if abs(total - 1.0) > 0.001:
        raise ValidationFailed(f"Weights must sum to 1.00 (currently {total:.3f}).", details={"sum": round(total, 3)})


def invalidate_cache() -> None:
    global _cache_loaded_at
    _cache_loaded_at = 0.0


def get_config(db: Session | None = None) -> dict[str, Any]:
    """Return merged config: DB values over defaults. Works without a DB (pure defaults)."""
    global _cache, _cache_loaded_at
    if db is None:
        return {**DEFAULT_CONFIG, **_cache}
    if time.monotonic() - _cache_loaded_at > _CACHE_TTL_S:
        from app.models import AppConfig

        rows = db.execute(select(AppConfig)).scalars().all()
        _cache = {r.key: r.value for r in rows}
        _cache_loaded_at = time.monotonic()
    return {**DEFAULT_CONFIG, **_cache}
