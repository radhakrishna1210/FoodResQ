"""Enums — ARCHITECTURE §4.1. Values are exact."""

from enum import StrEnum

from sqlalchemy.dialects.postgresql import ENUM


class UserRole(StrEnum):
    donor = "donor"
    receiver = "receiver"
    admin = "admin"


class AccountStatus(StrEnum):
    active = "active"
    pending_verification = "pending_verification"
    rejected = "rejected"
    suspended = "suspended"


class DonorType(StrEnum):
    restaurant = "restaurant"
    hotel = "hotel"
    college_hostel = "college_hostel"
    caterer_event = "caterer_event"
    other_business = "other_business"


class ReceiverType(StrEnum):
    ngo = "ngo"
    shelter = "shelter"
    community_org = "community_org"
    food_distributor = "food_distributor"


class FoodCategory(StrEnum):
    cooked_meal = "cooked_meal"
    bakery = "bakery"
    sweets = "sweets"
    dairy = "dairy"
    raw_produce = "raw_produce"
    packaged = "packaged"


class DietType(StrEnum):
    veg = "veg"
    egg = "egg"
    non_veg = "non_veg"


class DietAcceptance(StrEnum):
    veg_only = "veg_only"
    veg_egg = "veg_egg"
    all = "all"


class StorageCondition(StrEnum):
    hot_held = "hot_held"
    room_temp = "room_temp"
    refrigerated = "refrigerated"
    packaged_sealed = "packaged_sealed"


class DonationStatus(StrEnum):
    POSTED = "POSTED"
    MATCHED = "MATCHED"
    ACCEPTED = "ACCEPTED"
    COLLECTED = "COLLECTED"
    COMPLETED = "COMPLETED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    FLAGGED = "FLAGGED"


class PriorityLevel(StrEnum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class OfferStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    TIMED_OUT = "TIMED_OUT"
    SUPERSEDED = "SUPERSEDED"
    WITHDRAWN = "WITHDRAWN"


class AllocationStatus(StrEnum):
    ACCEPTED = "ACCEPTED"
    COLLECTED = "COLLECTED"
    COMPLETED = "COMPLETED"
    NO_SHOW = "NO_SHOW"
    CANCELLED = "CANCELLED"


class FeedbackDirection(StrEnum):
    donor_to_receiver = "donor_to_receiver"
    receiver_to_donor = "receiver_to_donor"


class ReportStatus(StrEnum):
    open = "open"
    resolved_valid = "resolved_valid"
    resolved_invalid = "resolved_invalid"


class DisputeReason(StrEnum):
    no_show = "no_show"
    quantity_mismatch = "quantity_mismatch"
    quality_issue = "quality_issue"
    behaviour = "behaviour"
    other = "other"


class DisputeStatus(StrEnum):
    open = "open"
    resolved = "resolved"


def pg_enum(py_enum: type[StrEnum], name: str) -> ENUM:
    """Postgres ENUM bound to an existing type (the migration creates the types)."""
    return ENUM(*[m.value for m in py_enum], name=name, create_type=False)


user_role = pg_enum(UserRole, "user_role")
account_status = pg_enum(AccountStatus, "account_status")
donor_type = pg_enum(DonorType, "donor_type")
receiver_type = pg_enum(ReceiverType, "receiver_type")
food_category = pg_enum(FoodCategory, "food_category")
diet_type = pg_enum(DietType, "diet_type")
diet_acceptance = pg_enum(DietAcceptance, "diet_acceptance")
storage_condition = pg_enum(StorageCondition, "storage_condition")
donation_status = pg_enum(DonationStatus, "donation_status")
priority_level = pg_enum(PriorityLevel, "priority_level")
offer_status = pg_enum(OfferStatus, "offer_status")
allocation_status = pg_enum(AllocationStatus, "allocation_status")
feedback_direction = pg_enum(FeedbackDirection, "feedback_direction")
report_status = pg_enum(ReportStatus, "report_status")
dispute_reason = pg_enum(DisputeReason, "dispute_reason")
dispute_status = pg_enum(DisputeStatus, "dispute_status")
