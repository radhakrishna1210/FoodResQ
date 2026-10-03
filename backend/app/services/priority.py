"""Priority — ARCHITECTURE §6.4. Pure functions."""

from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

PERISHABILITY = {
    "cooked_meal": 1.0, "dairy": 0.9, "sweets": 0.7, "bakery": 0.6, "raw_produce": 0.5, "packaged": 0.2,
}


@dataclass(frozen=True)
class Priority:
    score: float          # unrounded
    stored_score: Decimal  # numeric(4,3)
    level: str


def compute_priority(*, effective_deadline: datetime, remaining_servings: int, food_category: str,
                     now: datetime, cfg: dict[str, Any]) -> Priority:
    time_left_h = max((effective_deadline - now).total_seconds() / 3600, 0.0)
    urgency = 1 - min(time_left_h / 6, 1)
    quantity = min(remaining_servings / 200, 1)
    perishability = PERISHABILITY[food_category]
    score = 0.5 * urgency + 0.3 * quantity + 0.2 * perishability
    stored = Decimal(str(score)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    th = cfg["priority_thresholds"]
    level = "HIGH" if score >= th["high"] else "MEDIUM" if score >= th["medium"] else "LOW"
    return Priority(score=score, stored_score=stored, level=level)
