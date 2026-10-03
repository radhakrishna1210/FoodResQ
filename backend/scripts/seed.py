"""Seed data — WALKTHROUGH §2. Idempotent: re-running updates rather than duplicates.

    python -m scripts.seed                   # users + profiles (§2.1–2.3)
    python -m scripts.seed --reset           # delete demo donations/offers/allocations/etc, restore profiles
    python -m scripts.seed --history         # + 5 past COMPLETED donations (410 servings) over last 7 days
    python -m scripts.seed --demo-donation   # + the golden-demo donation relative to now (§2.5)

When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, Supabase Auth users are created (password Demo@1234)
and their ids are used. Otherwise deterministic ids are used (uuid5 of the email), which works with the
prototype-only DEV_AUTH_ENABLED login.
"""

import argparse
import secrets
import uuid
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import delete, select

from app.config import get_settings
from app.db import SessionLocal
from app.models import (
    Allocation,
    AssistantMessage,
    AuditLog,
    Dispute,
    Donation,
    DonorProfile,
    Feedback,
    MatchRun,
    Message,
    Notification,
    Offer,
    ReceiverProfile,
    SafetyReport,
    User,
)
from app.utils.time import now_utc, today_ist

PASSWORD = "Demo@1234"
ALL_DAY = {d: {"open": "00:00", "close": "24:00"} for d in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")}

USERS = [
    ("admin@foodresq.demo", "admin", "active", "FoodResQ Admin", "9000000099"),
    ("college.a@foodresq.demo", "donor", "active", "College A Coordinator", "9000000001"),
    ("receiver.a@foodresq.demo", "receiver", "active", "Receiver A Lead", "9000000011"),
    ("receiver.b@foodresq.demo", "receiver", "active", "Receiver B Lead", "9000000012"),
    ("receiver.c@foodresq.demo", "receiver", "active", "Receiver C Lead", "9000000013"),
    ("receiver.pending@foodresq.demo", "receiver", "pending_verification", "Pending NGO Lead", "9000000014"),
]

DONOR = dict(org_name="College A (Demo)", donor_type="college_hostel", address="Bibwewadi, Pune", lat=18.4636,
             lng=73.8682, is_verified=True, quality_score=Decimal("0.700"))

RECEIVERS = {
    "receiver.a@foodresq.demo": dict(
        org_name="Receiver A (Demo NGO)", receiver_type="ngo", fssai_registration_no="10012345000001",
        address="Market Yard, Pune", lat=18.4760, lng=73.8720, service_radius_km=Decimal("10"),
        max_capacity_servings=150, diet_accepted="veg_only", accepted_categories=["cooked_meal", "bakery", "sweets"],
        has_vehicle=True, has_storage=True, has_reheating=True, meals_needed_today=150,
        reliability_score=Decimal("0.900")),
    "receiver.b@foodresq.demo": dict(
        org_name="Receiver B (Demo Shelter)", receiver_type="shelter", fssai_registration_no="10012345000002",
        address="Dhankawadi, Pune", lat=18.4250, lng=73.8180, service_radius_km=Decimal("15"),
        max_capacity_servings=50, diet_accepted="veg_only", accepted_categories=["cooked_meal", "bakery"],
        has_vehicle=True, has_storage=False, has_reheating=True, meals_needed_today=60,
        reliability_score=Decimal("0.800")),
    "receiver.c@foodresq.demo": dict(
        org_name="Receiver C (Demo Community Pantry)", receiver_type="community_org",
        fssai_registration_no="10012345000003", address="Swargate, Pune", lat=18.4830, lng=73.8590,
        service_radius_km=Decimal("10"), max_capacity_servings=100, diet_accepted="all",
        accepted_categories=["packaged", "raw_produce"], has_vehicle=True, has_storage=True, has_reheating=False,
        meals_needed_today=100, reliability_score=Decimal("0.850")),
    "receiver.pending@foodresq.demo": dict(
        org_name="Demo Pending NGO", receiver_type="ngo", fssai_registration_no="10012345000004",
        address="Kothrud, Pune", lat=18.5074, lng=73.8077, service_radius_km=Decimal("10"),
        max_capacity_servings=80, diet_accepted="veg_egg", accepted_categories=["cooked_meal"], has_vehicle=False,
        has_storage=False, has_reheating=False, meals_needed_today=None, reliability_score=Decimal("0.700")),
}

CHECKLIST = {"hygienic_handling": True, "not_served_from_plates": True, "covered_containers": True,
             "segregated_from_waste": True, "no_spoilage_signs": True}


def _auth_id(email: str) -> uuid.UUID:
    s = get_settings()
    if s.supabase_url and s.supabase_service_role_key:
        from supabase import create_client

        client = create_client(s.supabase_url, s.supabase_service_role_key)
        for u in client.auth.admin.list_users():
            if (u.email or "").lower() == email:
                return uuid.UUID(u.id)
        res = client.auth.admin.create_user({"email": email, "password": PASSWORD, "email_confirm": True})
        return uuid.UUID(res.user.id)
    return uuid.uuid5(uuid.NAMESPACE_URL, f"foodresq-demo:{email}")


def seed_users(db) -> dict[str, User]:
    now = now_utc()
    out: dict[str, User] = {}
    admin_id = None
    for email, role, status, name, phone in USERS:
        u = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if u is None:
            u = User(id=_auth_id(email), email=email, role=role, account_status=status, full_name=name, phone=phone)
            db.add(u)
        else:
            u.role, u.account_status, u.full_name, u.phone = role, status, name, phone
        db.flush()
        out[email] = u
        if role == "admin":
            admin_id = u.id

    donor = out["college.a@foodresq.demo"]
    dp = db.get(DonorProfile, donor.id) or DonorProfile(user_id=donor.id)
    for k, v in DONOR.items():
        setattr(dp, k, v)
    db.add(dp)

    for email, fields in RECEIVERS.items():
        u = out[email]
        rp = db.get(ReceiverProfile, u.id) or ReceiverProfile(user_id=u.id)
        for k, v in fields.items():
            setattr(rp, k, v)
        rp.operating_hours = ALL_DAY
        rp.is_available_now = True
        rp.meals_needed_set_on = today_ist() if fields["meals_needed_today"] is not None else None
        verified = u.account_status == "active"
        rp.verified_at = now - timedelta(days=30) if verified else None
        rp.verified_by = admin_id if verified else None
        rp.rejection_reason = None
        db.add(rp)
    db.flush()
    return out


def reset(db, users: dict[str, User]) -> None:
    ids = [u.id for u in users.values()]
    donation_ids = list(db.execute(select(Donation.id).where(Donation.donor_id.in_(ids))).scalars())
    alloc_ids = list(db.execute(select(Allocation.id).where(Allocation.donation_id.in_(donation_ids))).scalars())
    db.execute(delete(SafetyReport).where(SafetyReport.donation_id.in_(donation_ids)))
    db.execute(delete(Dispute).where(Dispute.allocation_id.in_(alloc_ids)))
    db.execute(delete(Feedback).where(Feedback.allocation_id.in_(alloc_ids)))
    db.execute(delete(Message).where(Message.allocation_id.in_(alloc_ids)))
    db.execute(delete(Allocation).where(Allocation.id.in_(alloc_ids)))
    db.execute(delete(Offer).where(Offer.donation_id.in_(donation_ids)))
    db.execute(delete(MatchRun).where(MatchRun.donation_id.in_(donation_ids)))
    db.execute(delete(AuditLog).where(AuditLog.entity_id.in_(donation_ids + alloc_ids)))
    db.execute(delete(Donation).where(Donation.id.in_(donation_ids)))
    db.execute(delete(Notification).where(Notification.user_id.in_(ids)))
    db.execute(delete(AssistantMessage).where(AssistantMessage.user_id.in_(ids)))
    db.flush()


def history(db, users: dict[str, User]) -> None:
    """5 past COMPLETED donations, 410 servings total, previous 7 days, with feedback."""
    donor = users["college.a@foodresq.demo"]
    ra, rb = users["receiver.a@foodresq.demo"], users["receiver.b@foodresq.demo"]
    plan = [(1, 120, ra, "Veg thali"), (2, 100, ra, "Paneer rice"), (3, 50, rb, "Bread and buns"),
            (5, 90, ra, "Dal khichdi"), (6, 50, rb, "Veg pulao")]
    now = now_utc()
    for days_ago, servings, recv, title in plan:
        posted = now - timedelta(days=days_ago, hours=3)
        d = Donation(donor_id=donor.id, title=f"{title} ({servings} meals)", food_category="cooked_meal",
                     diet_type="veg", quantity_servings=servings, remaining_servings=0, storage_condition="hot_held",
                     ambient_above_32c=True, prepared_at=posted - timedelta(hours=1),
                     donor_pickup_by=posted + timedelta(hours=2), safe_pickup_deadline=posted + timedelta(hours=2,
                                                                                                         minutes=30),
                     effective_deadline=posted + timedelta(hours=2), pickup_address=DONOR["address"],
                     pickup_lat=DONOR["lat"], pickup_lng=DONOR["lng"], contact_phone="9000000001",
                     checklist=CHECKLIST, declaration_accepted=True, declaration_at=posted,
                     photo_paths=["demo/history.jpg"], status="COMPLETED", priority_score=Decimal("0.650"),
                     priority_level="MEDIUM", posted_at=posted, updated_at=posted + timedelta(hours=2))
        db.add(d)
        db.flush()
        a = Allocation(donation_id=d.id, receiver_id=recv.id, offer_id=None, servings=servings, status="COMPLETED",
                       handover_code=f"{secrets.randbelow(10000):04d}", accepted_at=posted + timedelta(minutes=6),
                       eta_at=posted + timedelta(minutes=30), collected_at=posted + timedelta(minutes=40),
                       servings_distributed=servings, distribution_area="Market Yard, Pune",
                       distributed_at=posted + timedelta(hours=1), completed_at=posted + timedelta(hours=1))
        db.add(a)
        db.flush()
        db.add(Feedback(allocation_id=a.id, from_user_id=donor.id, to_user_id=recv.id, direction="donor_to_receiver",
                        overall_rating=5, on_time=True, professional=True, proper_containers=True))
        db.add(Feedback(allocation_id=a.id, from_user_id=recv.id, to_user_id=donor.id, direction="receiver_to_donor",
                        overall_rating=5, quantity_matched=True, fresh_on_arrival=True, properly_packed=True))
    db.flush()


def demo_donation(db, users: dict[str, User]) -> Donation:
    """Golden-demo donation relative to now (§2.5); runs matching like a real post."""
    from app.services.donations import create_donation

    now = now_utc()
    data = dict(title="Veg pulao and dal (120 meals)", food_category="cooked_meal", diet_type="veg",
                quantity_servings=120, storage_condition="hot_held", ambient_above_32c=True,
                prepared_at=now - timedelta(minutes=94), donor_pickup_by=now + timedelta(minutes=116),
                pickup_address=DONOR["address"], pickup_lat=DONOR["lat"], pickup_lng=DONOR["lng"],
                pickup_instructions="Main canteen, gate 2", contact_phone="9000000001", checklist=CHECKLIST,
                declaration_accepted=True, photo_paths=["demo/golden.jpg"])
    return create_donation(db, users["college.a@foodresq.demo"], data, now=now)


def main() -> None:
    p = argparse.ArgumentParser(description="Seed FoodResQ demo data")
    p.add_argument("--reset", action="store_true")
    p.add_argument("--history", action="store_true")
    p.add_argument("--demo-donation", action="store_true")
    args = p.parse_args()
    db = SessionLocal()
    try:
        users = seed_users(db)
        if args.reset:
            reset(db, users)
            users = seed_users(db)
        if args.history:
            history(db, users)
        if args.demo_donation:
            d = demo_donation(db, users)
            print(f"Demo donation {d.id}: status={d.status} priority={d.priority_level} ({d.priority_score})")
        db.commit()
        print("Seeded users:", ", ".join(users))
    finally:
        db.close()


if __name__ == "__main__":
    main()
