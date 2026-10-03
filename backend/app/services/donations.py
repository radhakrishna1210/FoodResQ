"""Donation lifecycle — ARCHITECTURE §5.1, §6."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import Conflict, Forbidden, NotFound, ValidationFailed
from app.models import Allocation, Donation, DonorProfile, Offer, ReceiverProfile, SafetyReport, User
from app.services import notifications as notif
from app.services.app_config import get_config
from app.services.deadlines import compute_deadlines
from app.services.matching.engine import lock_donation, pending_offer_count, run_matching
from app.services.priority import compute_priority
from app.services.state import apply_transition, init_status
from app.services.validation import DonationDraft, auto_flag_reasons, validate_donation
from app.utils.time import now_utc

ACTIVE_ALLOC = ("ACCEPTED", "COLLECTED", "COMPLETED")


def create_donation(db: Session, donor: User, data: dict[str, Any], *, now: datetime | None = None) -> Donation:
    now = now or now_utc()
    cfg = get_config(db)
    if donor.account_status == "suspended":
        raise Forbidden("Your account is suspended. Contact FoodResQ.", code="ACCOUNT_SUSPENDED")
    if donor.account_status != "active":
        raise Forbidden("Your account is not active.", code="ACCOUNT_NOT_ACTIVE")
    profile = db.get(DonorProfile, donor.id)
    if profile is None:
        raise Forbidden("Please complete your donor profile first.")

    draft = DonationDraft(
        title=data["title"], quantity_servings=data["quantity_servings"],
        storage_condition=data["storage_condition"], ambient_above_32c=data.get("ambient_above_32c", True),
        prepared_at=data["prepared_at"], packaged_expiry_date=data.get("packaged_expiry_date"),
        donor_pickup_by=data["donor_pickup_by"], checklist=data.get("checklist") or {},
        declaration_accepted=data.get("declaration_accepted", False), pickup_lat=data["pickup_lat"],
        pickup_lng=data["pickup_lng"], contact_phone=data["contact_phone"],
    )
    deadlines = validate_donation(draft, now=now, cfg=cfg)

    has_open_report = db.execute(select(func.count()).select_from(SafetyReport).where(
        SafetyReport.donor_id == donor.id, SafetyReport.status == "open")).scalar_one() > 0
    flags = auto_flag_reasons(photo_paths=data.get("photo_paths") or [], quantity_servings=draft.quantity_servings,
                              donor_is_verified=profile.is_verified, donor_has_open_safety_report=has_open_report,
                              donor_quality_score=float(profile.quality_score))
    prio = compute_priority(effective_deadline=deadlines.effective_deadline,
                            remaining_servings=draft.quantity_servings, food_category=data["food_category"],
                            now=now, cfg=cfg)
    d = Donation(
        donor_id=donor.id, title=draft.title.strip(), description=data.get("description"),
        food_category=data["food_category"], diet_type=data["diet_type"],
        quantity_servings=draft.quantity_servings, remaining_servings=draft.quantity_servings,
        quantity_kg=data.get("quantity_kg"), allergens=data.get("allergens"),
        storage_condition=draft.storage_condition, ambient_above_32c=draft.ambient_above_32c,
        prepared_at=draft.prepared_at, packaged_expiry_date=draft.packaged_expiry_date,
        donor_pickup_by=draft.donor_pickup_by, safe_pickup_deadline=deadlines.safe_pickup_deadline,
        effective_deadline=deadlines.effective_deadline, pickup_address=data["pickup_address"],
        pickup_lat=draft.pickup_lat, pickup_lng=draft.pickup_lng,
        pickup_instructions=data.get("pickup_instructions"), contact_phone=draft.contact_phone,
        batch_no=data.get("batch_no"), temperature_c=data.get("temperature_c"), checklist=draft.checklist,
        declaration_accepted=True, declaration_at=now, photo_paths=data.get("photo_paths") or [],
        priority_score=prio.stored_score, priority_level=prio.level,
        search_radius_km=Decimal(str(cfg["search_radius_steps_km"][0])), flag_reasons=flags,
        posted_at=now, updated_at=now,
    )
    if flags:
        init_status(db, d, "donation", "FLAGGED", actor_id=donor.id, extra={"flag_reasons": flags})
        notif.notify(db, donor.id, "DONATION_FLAGGED", "Under review by FoodResQ team",
                     f"\"{d.title}\" needs a quick review before matching.", f"/donor/donations/{d.id}")
        notif.notify_admins(db, "DONATION_FLAGGED", "Donation needs review",
                            f"\"{d.title}\" from {profile.org_name}: {', '.join(flags)}", f"/admin/donations/{d.id}")
    else:
        init_status(db, d, "donation", "POSTED", actor_id=donor.id)
        run_matching(db, d.id, "posted", now=now)
    return d


def get_owned_donation(db: Session, donation_id: uuid.UUID, donor: User) -> Donation:
    d = db.get(Donation, donation_id)
    if d is None or d.donor_id != donor.id:
        raise NotFound("Donation not found.")
    return d


def withdraw_pending_offers(db: Session, d: Donation, actor_id: uuid.UUID | None, reason: str) -> list[Offer]:
    offers = db.execute(select(Offer).where(Offer.donation_id == d.id, Offer.status == "PENDING")
                        .with_for_update().execution_options(populate_existing=True)).scalars().all()
    for o in offers:
        apply_transition(db, o, "offer", "WITHDRAWN", actor_id=actor_id, reason=reason)
    return list(offers)


def allocations_of(db: Session, donation_id: uuid.UUID) -> list[Allocation]:
    return list(db.execute(select(Allocation).where(Allocation.donation_id == donation_id)).scalars())


def cancel_donation(db: Session, donation_id: uuid.UUID, donor: User, reason: str) -> Donation:
    if not reason or not reason.strip():
        raise ValidationFailed("Please give a reason.", details={"fields": {"reason": "Required."}})
    d = lock_donation(db, donation_id)
    if d is None or d.donor_id != donor.id:
        raise NotFound("Donation not found.")
    allocs = allocations_of(db, d.id)
    if any(a.status in ("COLLECTED", "COMPLETED") for a in allocs):
        raise Conflict("This donation can't be cancelled after food has been collected.", code="INVALID_TRANSITION")
    now = now_utc()
    affected: set[uuid.UUID] = {o.receiver_id for o in withdraw_pending_offers(db, d, donor.id, "donation_cancelled")}
    for a in allocs:
        if a.status == "ACCEPTED":
            a.cancelled_at, a.cancelled_by, a.cancel_reason = now, donor.id, reason
            apply_transition(db, a, "allocation", "CANCELLED", actor_id=donor.id, reason=reason)
            affected.add(a.receiver_id)
    d.cancel_reason = reason
    apply_transition(db, d, "donation", "CANCELLED", actor_id=donor.id, reason=reason)
    notif.notify_many(db, affected, "DONATION_CANCELLED", "Donation cancelled",
                      f"The donor cancelled \"{d.title}\".", "/receiver")
    return d


def expire_or_close(db: Session, d: Donation, now: datetime) -> None:
    """Deadline passed for POSTED/MATCHED/FLAGGED — §5.1 and §12 step 3."""
    if d.status not in ("POSTED", "MATCHED", "FLAGGED") or d.effective_deadline >= now:
        return
    withdraw_pending_offers(db, d, None, "deadline_passed")
    allocs = [a for a in allocations_of(db, d.id) if a.status in ACTIVE_ALLOC]
    if d.status != "FLAGGED" and allocs:
        d.expired_servings += d.remaining_servings
        d.remaining_servings = 0
        apply_transition(db, d, "donation", "ACCEPTED", actor_id=None,
                         extra={"expired_servings": d.expired_servings})
        reevaluate_donation(db, d)
    else:
        d.expired_servings += d.remaining_servings
        d.remaining_servings = 0
        apply_transition(db, d, "donation", "EXPIRED", actor_id=None)
        notif.notify(db, d.donor_id, "DONATION_EXPIRED", "Donation expired",
                     "This donation expired before a Receiver could collect it. Thank you for trying. "
                     "Posting earlier gives Receivers more time.", f"/donor/donations/{d.id}")


def reevaluate_donation(db: Session, d: Donation) -> None:
    """Advance ACCEPTED → COLLECTED → COMPLETED / EXPIRED based on allocations (§5.1)."""
    for _ in range(3):
        allocs = [a for a in allocations_of(db, d.id) if a.status != "CANCELLED"]
        statuses = [a.status for a in allocs]
        if d.status == "ACCEPTED":
            if not allocs or "ACCEPTED" in statuses:
                return
            if any(s in ("COLLECTED", "COMPLETED") for s in statuses):
                apply_transition(db, d, "donation", "COLLECTED", actor_id=None)
                continue
            apply_transition(db, d, "donation", "EXPIRED", actor_id=None)  # all NO_SHOW
            return
        if d.status == "COLLECTED":
            if all(s in ("COMPLETED", "NO_SHOW") for s in statuses) and "COMPLETED" in statuses:
                apply_transition(db, d, "donation", "COMPLETED", actor_id=None)
            return
        return


def return_servings_and_rematch(db: Session, d: Donation, servings: int, now: datetime) -> None:
    """An allocation was cancelled before collection (§5.1 ACCEPTED → POSTED, §7.1)."""
    if d.status in ("CANCELLED", "EXPIRED", "COMPLETED"):
        return
    if d.effective_deadline <= now:
        d.expired_servings += servings
        reevaluate_donation(db, d)
        return
    d.remaining_servings += servings
    if d.status == "ACCEPTED":
        apply_transition(db, d, "donation", "POSTED", actor_id=None, extra={"returned_servings": servings})
    elif d.status == "MATCHED" and pending_offer_count(db, d.id) == 0:
        apply_transition(db, d, "donation", "POSTED", actor_id=None)
    db.flush()
    run_matching(db, d.id, "allocation_cancelled", now=now)


def recompute_deadlines_preview(data: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any]:
    """Helper for clients/assistant; server remains the authority at create time."""
    d = compute_deadlines(storage_condition=data["storage_condition"],
                          ambient_above_32c=data.get("ambient_above_32c", True), prepared_at=data["prepared_at"],
                          packaged_expiry_date=data.get("packaged_expiry_date"),
                          donor_pickup_by=data["donor_pickup_by"], cfg=cfg)
    return {"effective_deadline": d.effective_deadline, "last_consumption_at": d.last_consumption_at}


def receiver_names(db: Session, ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not ids:
        return {}
    rows = db.execute(select(ReceiverProfile.user_id, ReceiverProfile.org_name)
                      .where(ReceiverProfile.user_id.in_(ids))).all()
    return dict(rows)
