"""Pure JEV run: evaluate every Receiver, rank included ones. No DB access."""

import math
from datetime import date, datetime, timedelta
from typing import Any

from app.services.matching.filters import capacity_available, first_failure
from app.services.matching.geo import eta_minutes, road_distance_km
from app.services.matching.reasons import build_reasons
from app.services.matching.scoring import compute_factors, match_score, select_weights
from app.services.matching.types import Candidate, DonationCtx, ReceiverCtx


def evaluate(d: DonationCtx, receivers: list[ReceiverCtx], *, now: datetime, today_ist: date,
             cfg: dict[str, Any]) -> tuple[dict[str, float], list[Candidate]]:
    """Returns (weights used, candidates sorted: included by rank, then excluded)."""
    weights = select_weights(d.priority_level, cfg)
    included: list[Candidate] = []
    excluded: list[Candidate] = []

    for r in receivers:
        dist = road_distance_km(d.pickup_lat, d.pickup_lng, r.lat, r.lng, cfg["road_factor"])
        eta = eta_minutes(dist, cfg["prep_buffer_minutes"], cfg["avg_speed_kmph"])
        arrival = now + timedelta(minutes=eta)
        cap = capacity_available(r)
        cand = Candidate(receiver_id=r.receiver_id, org_name=r.org_name, included=False, exclusion_code=None,
                         distance_km=dist, eta_minutes=eta, capacity_available=max(cap, 0),
                         created_at=r.created_at, arrival_at=arrival)
        code = first_failure(d, r, dist, arrival)
        if code:
            cand.exclusion_code = code
            excluded.append(cand)
            continue
        cand.included = True
        cand.factors = compute_factors(d, r, distance_km=dist, arrival_at=arrival, now=now, today_ist=today_ist)
        cand.match_score = match_score(cand.factors, weights)
        cand.reasons = build_reasons(factors=cand.factors, weights=weights, distance_km=dist, eta_minutes=eta,
                                     remaining=d.remaining_servings, capacity_available=cap,
                                     diet_type=d.diet_type)
        included.append(cand)

    # Ties: higher feasibility, then shorter distance, then earlier receiver_profiles.created_at
    included.sort(key=lambda c: (-(c.match_score or 0), -c.factors["feasibility"], c.distance_km,
                                 c.created_at or datetime.max))
    for i, c in enumerate(included, start=1):
        c.rank = i
    return weights, included + excluded


def offer_timeout_minutes(effective_deadline: datetime, now: datetime, cfg: dict[str, Any]) -> int:
    """clamp(floor(time_left_minutes × 0.10), 5, 15). ARCHITECTURE §7.7."""
    lo, hi = cfg["offer_timeout_min_max"]
    time_left_min = (effective_deadline - now).total_seconds() / 60
    return int(max(lo, min(hi, math.floor(time_left_min * cfg["offer_timeout_fraction"] + 1e-9))))


def batch_size(priority_level: str, cfg: dict[str, Any]) -> int:
    return int(cfg["high_priority_batch_size"]) if priority_level == "HIGH" else 1
