"""Reason generation — ARCHITECTURE §7.6. Max 3 positives (by weighted contribution) + all warnings."""

DIET_LABEL = {"veg": "veg", "egg": "egg", "non_veg": "non-veg"}
FALLBACK_REASON = "Best available option nearby"


def build_reasons(*, factors: dict[str, float], weights: dict[str, float], distance_km: float, eta_minutes: int,
                  remaining: int, capacity_available: int, diet_type: str) -> list[str]:
    positives: list[tuple[float, str]] = []

    def contrib(name: str) -> float:
        return float(weights[name]) * factors[name]

    d = factors["distance"]
    if d >= 0.7:
        positives.append((contrib("distance"), f"Very close: {distance_km:g} km (about {eta_minutes} min)"))
    elif d >= 0.4:
        positives.append((contrib("distance"), f"Nearby: {distance_km:g} km (about {eta_minutes} min)"))
    if factors["capacity"] >= 1.0:
        positives.append((contrib("capacity"), f"Can take all {remaining} servings"))
    if factors["demand"] >= 0.8:
        positives.append((contrib("demand"), f"Needs {DIET_LABEL[diet_type]} meals today"))
    if factors["reliability"] >= 0.85:
        positives.append((contrib("reliability"), "Reliable: strong pickup record"))
    if factors["feasibility"] >= 0.7:
        positives.append((contrib("feasibility"), "Arrives well before the deadline"))

    positives.sort(key=lambda p: p[0], reverse=True)
    reasons = [text for _, text in positives[:3]]
    if not reasons:
        reasons = [FALLBACK_REASON]

    if factors["capacity"] < 1.0:
        reasons.append(f"Partial fit: can take {min(capacity_available, remaining)} of {remaining} servings")
    if factors["feasibility"] < 0.3:
        reasons.append("Tight timing: arrives close to the deadline")
    return reasons
