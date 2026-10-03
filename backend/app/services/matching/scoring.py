"""Stage 2 — eight factors and weighted score. ARCHITECTURE §7.4–7.5."""

import math
from datetime import date, datetime

from app.services.matching.filters import capacity_available, effective_radius
from app.services.matching.hours import minutes_open_after
from app.services.matching.types import DonationCtx, ReceiverCtx

NARROWEST_ACCEPTANCE = {"veg": "veg_only", "egg": "veg_egg", "non_veg": "all"}


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def compute_factors(d: DonationCtx, r: ReceiverCtx, *, distance_km: float, arrival_at: datetime,
                    now: datetime, today_ist: date) -> dict[str, float]:
    remaining = d.remaining_servings
    cap = capacity_available(r)

    distance = max(0.0, 1 - distance_km / effective_radius(r, d))
    capacity = min(cap, remaining) / remaining
    diet = 1.0 if r.diet_accepted == NARROWEST_ACCEPTANCE[d.diet_type] else 0.8
    if r.meals_needed_set_on == today_ist and r.meals_needed_today is not None:
        needed_remaining = max(0, r.meals_needed_today - r.allocated_today)
        demand = min(needed_remaining, remaining) / remaining
    else:
        demand = 0.5
    availability = 1.0 if minutes_open_after(r.operating_hours, arrival_at) >= 60 else 0.5
    total_window = (d.effective_deadline - now).total_seconds()
    feasibility = clamp((d.effective_deadline - arrival_at).total_seconds() / total_window, 0, 1) \
        if total_window > 0 else 0.0
    return {
        "distance": distance,
        "capacity": capacity,
        "feasibility": feasibility,
        "demand": demand,
        "reliability": float(r.reliability_score),
        "diet": diet,
        "availability": availability,
    }


def weighted_contributions(factors: dict[str, float], weights: dict[str, float]) -> dict[str, float]:
    return {k: float(weights[k]) * factors[k] for k in weights}


def match_score(factors: dict[str, float], weights: dict[str, float]) -> int:
    """round(100 × Σ weight × factor), half-up, integer 0–100."""
    total = 100 * sum(weighted_contributions(factors, weights).values())
    return int(clamp(math.floor(total + 0.5), 0, 100))


def select_weights(priority_level: str, cfg: dict) -> dict[str, float]:
    """Urgency factor: switches to the HIGH weight set when food is about to expire."""
    return cfg["jev_weights_high"] if priority_level == "HIGH" else cfg["jev_weights_default"]
