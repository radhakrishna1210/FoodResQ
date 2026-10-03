"""Onboarding and profiles — ARCHITECTURE §3.2, §10.1–10.3."""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.errors import Conflict, Forbidden
from app.models import DonorProfile, ReceiverProfile, User
from app.services.audit import write_audit
from app.utils.time import now_utc, today_ist

DONOR_EDITABLE = ("org_name", "donor_type", "fssai_license_no", "address", "lat", "lng")
RECEIVER_EDITABLE = ("org_name", "receiver_type", "fssai_registration_no", "ngo_darpan_id", "address", "lat",
                     "lng", "service_radius_km", "max_capacity_servings", "diet_accepted", "accepted_categories",
                     "has_vehicle", "has_storage", "has_reheating", "operating_hours", "is_available_now",
                     "verification_doc_path")
REVERIFY_FIELDS = ("fssai_registration_no", "address")


def onboard(db: Session, auth_user_id: uuid.UUID, email: str, data: dict[str, Any]) -> User:
    if db.get(User, auth_user_id) is not None:
        raise Conflict("You have already completed onboarding.", code="ALREADY_ONBOARDED")
    role = data["role"]
    if role == "admin":
        raise Forbidden("Admin accounts can't be created through signup.")
    profile = data["profile"]
    user = User(id=auth_user_id, role=role, full_name=data["full_name"].strip(), email=email.lower(),
                phone=data["phone"], account_status="active" if role == "donor" else "pending_verification")
    db.add(user)
    db.flush()
    if role == "donor":
        db.add(DonorProfile(user_id=user.id, **{k: profile.get(k) for k in DONOR_EDITABLE}))
    else:
        fields = {k: profile.get(k) for k in RECEIVER_EDITABLE if profile.get(k) is not None}
        db.add(ReceiverProfile(user_id=user.id, **fields))
    db.flush()
    write_audit(db, actor_id=user.id, action="user.onboarded", entity_type="user", entity_id=user.id,
                after={"role": role, "account_status": user.account_status})
    return user


def update_me(db: Session, user: User, data: dict[str, Any]) -> User:
    for k in ("full_name", "phone"):
        if data.get(k) is not None:
            setattr(user, k, data[k])
    user.updated_at = now_utc()
    return user


def update_donor_profile(db: Session, user: User, data: dict[str, Any]) -> DonorProfile:
    p = db.get(DonorProfile, user.id)
    for k in DONOR_EDITABLE:
        if k in data and data[k] is not None:
            setattr(p, k, data[k])
    return p


def update_receiver_profile(db: Session, user: User, data: dict[str, Any]) -> ReceiverProfile:
    """Editing FSSAI no. or address resets verification to pending (§10.3)."""
    p = db.get(ReceiverProfile, user.id)
    reverify = False
    for k in RECEIVER_EDITABLE:
        if k in data and data[k] is not None:
            if k in REVERIFY_FIELDS and getattr(p, k) != data[k]:
                reverify = True
            setattr(p, k, data[k])
    if user.account_status == "rejected":
        reverify = True  # "Edit profile and resubmit"
    if reverify and user.account_status in ("active", "rejected"):
        before = user.account_status
        user.account_status = "pending_verification"
        p.verified_at, p.verified_by, p.rejection_reason = None, None, None
        write_audit(db, actor_id=user.id, action="user.reverification_required", entity_type="user",
                    entity_id=user.id, before={"account_status": before},
                    after={"account_status": "pending_verification"})
    return p


def set_availability(db: Session, user: User, is_available_now: bool) -> ReceiverProfile:
    p = db.get(ReceiverProfile, user.id)
    p.is_available_now = is_available_now
    return p


def set_needs(db: Session, user: User, meals_needed_today: int) -> ReceiverProfile:
    p = db.get(ReceiverProfile, user.id)
    p.meals_needed_today = meals_needed_today
    p.meals_needed_set_on = today_ist()
    return p
