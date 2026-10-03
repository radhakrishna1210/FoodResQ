"""Stage 1 — hard filters. ARCHITECTURE §7.3. Returns the FIRST failing code, or None."""

from datetime import datetime

from app.services.matching.hours import is_open_at
from app.services.matching.types import DonationCtx, ReceiverCtx

DIET_ALLOWED = {
    "veg": {"veg_only", "veg_egg", "all"},
    "egg": {"veg_egg", "all"},
    "non_veg": {"all"},
}

# Labels shown to Admin (§7.6)
EXCLUSION_LABELS = {
    "not_verified": "Receiver not verified",
    "unavailable": "Not available right now",
    "closed_at_arrival": "Closed at arrival time",
    "diet_mismatch": "Different food requirement",
    "category_not_accepted": "Does not accept this food type",
    "out_of_radius": "Outside service area",
    "cannot_arrive_in_time": "Cannot arrive before deadline",
    "no_capacity": "No capacity left",
    "already_offered": "Already offered this donation",
}


def capacity_available(r: ReceiverCtx) -> int:
    return r.max_capacity_servings - r.held_servings


def effective_radius(r: ReceiverCtx, d: DonationCtx) -> float:
    return min(float(r.service_radius_km), float(d.search_radius_km))


def first_failure(d: DonationCtx, r: ReceiverCtx, distance_km: float, arrival_at: datetime) -> str | None:
    if not (r.account_status == "active" and r.role == "receiver" and r.verified_at is not None):
        return "not_verified"
    if not r.is_available_now:
        return "unavailable"
    if not is_open_at(r.operating_hours, arrival_at):
        return "closed_at_arrival"
    if r.diet_accepted not in DIET_ALLOWED[d.diet_type]:
        return "diet_mismatch"
    if d.food_category not in r.accepted_categories:
        return "category_not_accepted"
    if distance_km > effective_radius(r, d):
        return "out_of_radius"
    if arrival_at > d.effective_deadline:
        return "cannot_arrive_in_time"
    if capacity_available(r) < 1:
        return "no_capacity"
    if r.already_offered:
        return "already_offered"
    return None
