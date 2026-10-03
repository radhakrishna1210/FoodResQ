"""Pydantic request models. DB CHECK constraints are the second layer (ARCHITECTURE §15)."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

PHONE = r"^[6-9][0-9]{9}$"
FSSAI = r"^[0-9]{14}$"

DonorTypeL = Literal["restaurant", "hotel", "college_hostel", "caterer_event", "other_business"]
ReceiverTypeL = Literal["ngo", "shelter", "community_org", "food_distributor"]
FoodCategoryL = Literal["cooked_meal", "bakery", "sweets", "dairy", "raw_produce", "packaged"]
DietTypeL = Literal["veg", "egg", "non_veg"]
DietAcceptanceL = Literal["veg_only", "veg_egg", "all"]
StorageL = Literal["hot_held", "room_temp", "refrigerated", "packaged_sealed"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DayHours(Strict):
    open: str = Field(pattern=r"^([01][0-9]|2[0-3]):[0-5][0-9]$")
    close: str = Field(pattern=r"^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$")


class OperatingHours(Strict):
    mon: DayHours | None = None
    tue: DayHours | None = None
    wed: DayHours | None = None
    thu: DayHours | None = None
    fri: DayHours | None = None
    sat: DayHours | None = None
    sun: DayHours | None = None


class DonorProfileIn(Strict):
    org_name: str = Field(min_length=2, max_length=120)
    donor_type: DonorTypeL
    fssai_license_no: str | None = Field(default=None, pattern=FSSAI)
    address: str = Field(min_length=3)
    lat: float = Field(ge=6, le=38)
    lng: float = Field(ge=68, le=98)


class DonorProfilePatch(Strict):
    org_name: str | None = Field(default=None, min_length=2, max_length=120)
    donor_type: DonorTypeL | None = None
    fssai_license_no: str | None = Field(default=None, pattern=FSSAI)
    address: str | None = None
    lat: float | None = Field(default=None, ge=6, le=38)
    lng: float | None = Field(default=None, ge=68, le=98)


class ReceiverProfileIn(Strict):
    org_name: str = Field(min_length=2, max_length=120)
    receiver_type: ReceiverTypeL
    fssai_registration_no: str = Field(pattern=FSSAI)
    ngo_darpan_id: str | None = None
    address: str = Field(min_length=3)
    lat: float = Field(ge=6, le=38)
    lng: float = Field(ge=68, le=98)
    service_radius_km: float = Field(default=10, ge=1, le=20)
    max_capacity_servings: int = Field(ge=1, le=2000)
    diet_accepted: DietAcceptanceL
    accepted_categories: list[FoodCategoryL] = Field(min_length=1)
    has_vehicle: bool = False
    has_storage: bool = False
    has_reheating: bool = False
    operating_hours: OperatingHours
    verification_doc_path: str | None = None


class ReceiverProfilePatch(Strict):
    org_name: str | None = Field(default=None, min_length=2, max_length=120)
    receiver_type: ReceiverTypeL | None = None
    fssai_registration_no: str | None = Field(default=None, pattern=FSSAI)
    ngo_darpan_id: str | None = None
    address: str | None = None
    lat: float | None = Field(default=None, ge=6, le=38)
    lng: float | None = Field(default=None, ge=68, le=98)
    service_radius_km: float | None = Field(default=None, ge=1, le=20)
    max_capacity_servings: int | None = Field(default=None, ge=1, le=2000)
    diet_accepted: DietAcceptanceL | None = None
    accepted_categories: list[FoodCategoryL] | None = Field(default=None, min_length=1)
    has_vehicle: bool | None = None
    has_storage: bool | None = None
    has_reheating: bool | None = None
    operating_hours: OperatingHours | None = None
    verification_doc_path: str | None = None


class OnboardingIn(Strict):
    role: Literal["donor", "receiver", "admin"]  # admin accepted by schema so the API can return 403
    full_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=PHONE)
    profile: dict


class MePatch(Strict):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, pattern=PHONE)


class DonationIn(Strict):
    title: str
    description: str | None = Field(default=None, max_length=500)
    food_category: FoodCategoryL
    diet_type: DietTypeL
    quantity_servings: int
    quantity_kg: float | None = Field(default=None, ge=0)
    allergens: str | None = Field(default=None, max_length=200)
    storage_condition: StorageL
    ambient_above_32c: bool = True
    prepared_at: datetime
    packaged_expiry_date: date | None = None
    donor_pickup_by: datetime
    pickup_address: str = Field(min_length=3)
    pickup_lat: float
    pickup_lng: float
    pickup_instructions: str | None = Field(default=None, max_length=300)
    contact_phone: str
    batch_no: str | None = None
    temperature_c: float | None = None
    checklist: dict[str, bool]
    declaration_accepted: bool
    photo_paths: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("prepared_at", "donor_pickup_by")
    @classmethod
    def _tz_required(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("Timestamp must include a timezone (ISO 8601 with Z or offset).")
        return v


class ReasonIn(Strict):
    reason: str = Field(min_length=1, max_length=500)


class HandoverIn(Strict):
    code: str = Field(pattern=r"^[0-9]{4}$")


class AvailabilityIn(Strict):
    is_available_now: bool


class NeedsIn(Strict):
    meals_needed_today: int = Field(ge=0, le=100000)


class DeclineIn(Strict):
    reason_code: Literal["no_capacity", "too_far", "no_vehicle_now", "food_type", "other"]
    note: str | None = Field(default=None, max_length=300)


class CompleteIn(Strict):
    servings_distributed: int = Field(ge=0)
    distribution_area: str = Field(min_length=1, max_length=200)


class MessageIn(Strict):
    body: str = Field(min_length=1, max_length=1000)


class FeedbackIn(Strict):
    overall_rating: int = Field(ge=1, le=5)
    on_time: bool | None = None
    professional: bool | None = None
    proper_containers: bool | None = None
    quantity_matched: bool | None = None
    fresh_on_arrival: bool | None = None
    properly_packed: bool | None = None
    safety_issue: bool = False
    comment: str | None = Field(default=None, max_length=500)
    photo_path: str | None = None


class DisputeIn(Strict):
    reason: Literal["no_show", "quantity_mismatch", "quality_issue", "behaviour", "other"]
    description: str = Field(min_length=10, max_length=1000)


class NotificationsReadIn(Strict):
    ids: list[uuid.UUID] | None = None
    all: bool = False


class UploadSignIn(Strict):
    bucket: Literal["donation-photos", "verification-docs", "feedback-photos"]
    content_type: str
    allocation_id: uuid.UUID | None = None


class AssignIn(Strict):
    receiver_id: uuid.UUID
    servings: int = Field(ge=1)
    note: str = Field(min_length=1, max_length=500)


class SafetyResolveIn(Strict):
    status: Literal["resolved_valid", "resolved_invalid"]
    admin_notes: str | None = Field(default=None, max_length=1000)


class DisputeResolveIn(Strict):
    resolution: str = Field(min_length=1, max_length=1000)


class CreateAdminIn(Strict):
    user_id: uuid.UUID
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=PHONE)


class DevLoginIn(Strict):
    email: EmailStr


class AssistantChatIn(Strict):
    conversation_id: uuid.UUID | None = None
    message: str = Field(min_length=1, max_length=1000)
