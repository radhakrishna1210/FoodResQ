"""Hard validation (§6.1), safe deadline (§6.2) and auto-flag rules (§6.3)."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from app.errors import ValidationFailed
from app.services.deadlines import Deadlines, compute_deadlines
from app.utils.time import today_ist

CHECKLIST_KEYS = ("hygienic_handling", "not_served_from_plates", "covered_containers", "segregated_from_waste",
                  "no_spoilage_signs")
TOO_CLOSE_MESSAGE = "This food is too close to its safe limit to be rescued safely."


@dataclass(frozen=True)
class DonationDraft:
    title: str
    quantity_servings: int
    storage_condition: str
    ambient_above_32c: bool
    prepared_at: datetime
    packaged_expiry_date: date | None
    donor_pickup_by: datetime
    checklist: dict[str, Any]
    declaration_accepted: bool
    pickup_lat: float
    pickup_lng: float
    contact_phone: str


def validate_donation(d: DonationDraft, *, now: datetime, cfg: dict[str, Any]) -> Deadlines:
    """Raise ValidationFailed (422, field-level details) or return computed deadlines."""
    import re

    errors: dict[str, str] = {}
    if not 3 <= len(d.title.strip()) <= 80:
        errors["title"] = "Food name must be 3–80 characters."
    if not 1 <= d.quantity_servings <= 1000:
        errors["quantity_servings"] = "Servings must be between 1 and 1000."
    if d.prepared_at > now + timedelta(minutes=2):
        errors["prepared_at"] = "Preparation time cannot be in the future."
    elif d.storage_condition != "packaged_sealed" and d.prepared_at < now - timedelta(hours=24):
        errors["prepared_at"] = "Cooked food older than 24 hours cannot be posted."
    if d.storage_condition == "packaged_sealed":
        if d.packaged_expiry_date is None:
            errors["packaged_expiry_date"] = "Expiry date is required for sealed packaged food."
        elif d.packaged_expiry_date < today_ist(now):
            errors["packaged_expiry_date"] = "This packaged food has already expired."
    if d.donor_pickup_by < now + timedelta(minutes=30):
        errors["donor_pickup_by"] = "Pickup time must be at least 30 minutes from now."
    elif d.donor_pickup_by > now + timedelta(hours=48):
        errors["donor_pickup_by"] = "Pickup time must be within the next 48 hours."
    missing = [k for k in CHECKLIST_KEYS if d.checklist.get(k) is not True]
    if missing:
        errors["checklist"] = "Please confirm every item in the safety checklist."
        for k in missing:
            errors[f"checklist.{k}"] = "Required."
    if d.declaration_accepted is not True:
        errors["declaration_accepted"] = "Please accept the declaration."
    if not (6 <= d.pickup_lat <= 38 and 68 <= d.pickup_lng <= 98):
        errors["pickup_lat"] = "Pickup location must be in India."
    if not re.fullmatch(r"[6-9][0-9]{9}", d.contact_phone or ""):
        errors["contact_phone"] = "Enter a 10-digit Indian mobile number."
    if errors:
        raise ValidationFailed("Please check the highlighted fields.", details={"fields": errors})

    deadlines = compute_deadlines(storage_condition=d.storage_condition, ambient_above_32c=d.ambient_above_32c,
                                  prepared_at=d.prepared_at, packaged_expiry_date=d.packaged_expiry_date,
                                  donor_pickup_by=d.donor_pickup_by, cfg=cfg)
    if deadlines.effective_deadline < now + timedelta(minutes=cfg["min_rescue_window_minutes"]):
        raise ValidationFailed(TOO_CLOSE_MESSAGE, code="TOO_CLOSE_TO_SAFE_LIMIT",
                               details={"fields": {"prepared_at": TOO_CLOSE_MESSAGE}})
    return deadlines


def auto_flag_reasons(*, photo_paths: list[str], quantity_servings: int, donor_is_verified: bool,
                      donor_has_open_safety_report: bool, donor_quality_score: float) -> list[str]:
    reasons: list[str] = []
    if not photo_paths:
        reasons.append("missing_photo")
    if 501 <= quantity_servings <= 1000:
        reasons.append("large_quantity")
    if not donor_is_verified and quantity_servings > 200:
        reasons.append("unverified_large_donor")
    if donor_has_open_safety_report:
        reasons.append("open_safety_report")
    if donor_quality_score < 0.4:
        reasons.append("low_quality_donor")
    return reasons
