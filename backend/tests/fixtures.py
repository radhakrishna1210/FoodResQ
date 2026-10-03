"""Golden-demo fixture: WALKTHROUGH §2.2–2.3 and §3, as pure engine inputs."""

import uuid
from datetime import date, datetime, timedelta

from app.services.matching.types import DonationCtx, ReceiverCtx
from app.utils.time import IST

ALL_DAY = {d: {"open": "00:00", "close": "24:00"} for d in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")}

COLLEGE_A = (18.4636, 73.8682)
TODAY = date(2026, 10, 4)
NOW = datetime(2026, 10, 4, 20, 34, tzinfo=IST)           # posted 8:34 PM IST
PREPARED_AT = datetime(2026, 10, 4, 19, 0, tzinfo=IST)    # cooked 7:00 PM
PICKUP_BY = datetime(2026, 10, 4, 22, 30, tzinfo=IST)     # wants pickup by 10:30 PM

RECEIVER_A_ID = uuid.UUID("00000000-0000-0000-0000-00000000000a")
RECEIVER_B_ID = uuid.UUID("00000000-0000-0000-0000-00000000000b")
RECEIVER_C_ID = uuid.UUID("00000000-0000-0000-0000-00000000000c")


def receiver(rid, name, lat, lng, radius, cap, diet, cats, meals, reliability, created_offset_min, **kw):
    base = dict(
        receiver_id=rid, org_name=name, role="receiver", account_status="active",
        verified_at=NOW - timedelta(days=30), is_available_now=True, operating_hours=ALL_DAY,
        diet_accepted=diet, accepted_categories=cats, lat=lat, lng=lng, service_radius_km=radius,
        max_capacity_servings=cap, held_servings=0, meals_needed_today=meals, meals_needed_set_on=TODAY,
        allocated_today=0, reliability_score=reliability,
        created_at=NOW - timedelta(days=60) + timedelta(minutes=created_offset_min),
    )
    base.update(kw)
    return ReceiverCtx(**base)


def golden_receivers(**overrides) -> list[ReceiverCtx]:
    return [
        receiver(RECEIVER_A_ID, "Receiver A (Demo NGO)", 18.4760, 73.8720, 10, 150, "veg_only",
                 ["cooked_meal", "bakery", "sweets"], 150, 0.900, 0, **overrides.get("a", {})),
        receiver(RECEIVER_B_ID, "Receiver B (Demo Shelter)", 18.4250, 73.8180, 15, 50, "veg_only",
                 ["cooked_meal", "bakery"], 60, 0.800, 1, **overrides.get("b", {})),
        receiver(RECEIVER_C_ID, "Receiver C (Demo Community Pantry)", 18.4830, 73.8590, 10, 100, "all",
                 ["packaged", "raw_produce"], 100, 0.850, 2, **overrides.get("c", {})),
    ]


def golden_donation(effective_deadline=PICKUP_BY, remaining=120, radius=10, priority="HIGH") -> DonationCtx:
    return DonationCtx(
        id=None, food_category="cooked_meal", diet_type="veg", remaining_servings=remaining,
        effective_deadline=effective_deadline, search_radius_km=radius, priority_level=priority,
        pickup_lat=COLLEGE_A[0], pickup_lng=COLLEGE_A[1],
    )
