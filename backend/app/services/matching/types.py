"""Plain data passed into the pure JEV engine (no DB access inside scoring)."""

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass(frozen=True)
class DonationCtx:
    id: uuid.UUID | None
    food_category: str
    diet_type: str
    remaining_servings: int
    effective_deadline: datetime
    search_radius_km: float
    priority_level: str
    pickup_lat: float
    pickup_lng: float


@dataclass(frozen=True)
class ReceiverCtx:
    receiver_id: uuid.UUID
    org_name: str
    role: str
    account_status: str
    verified_at: datetime | None
    is_available_now: bool
    operating_hours: dict
    diet_accepted: str
    accepted_categories: list[str]
    lat: float
    lng: float
    service_radius_km: float
    max_capacity_servings: int
    held_servings: int            # Σ servings of ACCEPTED (not yet collected) allocations
    meals_needed_today: int | None
    meals_needed_set_on: date | None
    allocated_today: int          # servings allocated to this Receiver today (IST)
    reliability_score: float
    created_at: datetime
    already_offered: bool = False


@dataclass
class Candidate:
    receiver_id: uuid.UUID
    org_name: str
    included: bool
    exclusion_code: str | None
    distance_km: float
    eta_minutes: int
    capacity_available: int
    factors: dict[str, float] = field(default_factory=dict)
    match_score: int | None = None
    rank: int | None = None
    reasons: list[str] = field(default_factory=list)
    # internal, for tie-breaks / offers
    created_at: datetime | None = None
    arrival_at: datetime | None = None

    def to_json(self) -> dict:
        return {
            "receiver_id": str(self.receiver_id),
            "org_name": self.org_name,
            "included": self.included,
            "exclusion_code": self.exclusion_code,
            "distance_km": self.distance_km,
            "eta_minutes": self.eta_minutes,
            "capacity_available": self.capacity_available,
            "factors": {k: round(v, 4) for k, v in self.factors.items()},
            "match_score": self.match_score,
            "rank": self.rank,
            "reasons": self.reasons,
        }
