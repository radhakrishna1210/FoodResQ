"""Distance and ETA — ARCHITECTURE §7.2."""

import math
from decimal import ROUND_HALF_UP, Decimal

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def road_distance_km(lat1: float, lng1: float, lat2: float, lng2: float, road_factor: float) -> float:
    """distance_km = round(haversine × road_factor, 1), half-up."""
    raw = haversine_km(lat1, lng1, lat2, lng2) * road_factor
    return float(Decimal(str(raw)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def eta_minutes(distance_km: float, prep_buffer_minutes: float, avg_speed_kmph: float) -> int:
    """eta = ceil(prep_buffer + distance / speed × 60). Small epsilon guards float noise (e.g. 20.0000001)."""
    return math.ceil(prep_buffer_minutes + distance_km / avg_speed_kmph * 60 - 1e-9)
