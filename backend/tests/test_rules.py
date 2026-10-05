"""Pure unit tests: deadlines per storage condition, flags, state machine, timeouts, hours, trust formulas."""

from datetime import date, datetime, timedelta

import pytest

from app.errors import InvalidTransition, ValidationFailed
from app.services.app_config import DEFAULT_CONFIG as CFG
from app.services.app_config import validate_weights
from app.services.deadlines import compute_deadlines
from app.services.matching.hours import is_open_at, minutes_open_after
from app.services.matching.ranking import offer_timeout_minutes
from app.services.state import (
    ALLOCATION_TRANSITIONS,
    DONATION_TRANSITIONS,
    OFFER_TRANSITIONS,
    assert_transition,
)
from app.services.trust import quality_formula, reliability_formula
from app.services.validation import DonationDraft, auto_flag_reasons, validate_donation
from app.utils.time import IST

NOW = datetime(2026, 10, 4, 20, 34, tzinfo=IST)
CHECKLIST = {
    k: True
    for k in (
        "hygienic_handling",
        "not_served_from_plates",
        "covered_containers",
        "segregated_from_waste",
        "no_spoilage_signs",
    )
}


def dl(storage, prepared, pickup, ambient=True, expiry=None):
    return compute_deadlines(
        storage_condition=storage,
        ambient_above_32c=ambient,
        prepared_at=prepared,
        packaged_expiry_date=expiry,
        donor_pickup_by=pickup,
        cfg=CFG,
    )


@pytest.mark.parametrize(
    "storage,ambient,hours",
    [("hot_held", True, 6), ("room_temp", False, 6), ("room_temp", True, 6), ("refrigerated", True, 12)],
)
def test_safe_window_per_storage(storage, ambient, hours):
    prepared = NOW - timedelta(minutes=10)
    d = dl(storage, prepared, NOW + timedelta(hours=48), ambient)
    assert d.safe_pickup_deadline == prepared + timedelta(hours=hours)
    assert d.last_consumption_at == d.safe_pickup_deadline + timedelta(hours=4)
    assert d.effective_deadline == d.safe_pickup_deadline


def test_packaged_uses_expiry_minus_18h():
    d = dl("packaged_sealed", NOW, NOW + timedelta(hours=48), expiry=date(2026, 10, 6))
    assert d.safe_pickup_deadline == datetime(2026, 10, 6, 5, 59, tzinfo=IST)
    assert d.effective_deadline == d.safe_pickup_deadline


def draft(**over):
    base = dict(
        title="Veg pulao",
        quantity_servings=120,
        storage_condition="hot_held",
        ambient_above_32c=True,
        prepared_at=NOW - timedelta(minutes=94),
        packaged_expiry_date=None,
        donor_pickup_by=NOW + timedelta(minutes=116),
        checklist=CHECKLIST,
        declaration_accepted=True,
        pickup_lat=18.46,
        pickup_lng=73.87,
        contact_phone="9000000001",
    )
    base.update(over)
    return DonationDraft(**base)


def test_too_close_to_safe_limit_rejected():
    with pytest.raises(ValidationFailed) as e:
        validate_donation(
            draft(
                storage_condition="room_temp",
                prepared_at=NOW - timedelta(hours=5, minutes=40),
                donor_pickup_by=NOW + timedelta(hours=3),
            ),
            now=NOW,
            cfg=CFG,
        )
    assert e.value.message == "This food is too close to its safe limit to be rescued safely."


@pytest.mark.parametrize(
    "over,field",
    [
        ({"title": "ab"}, "title"),
        ({"quantity_servings": 0}, "quantity_servings"),
        ({"prepared_at": NOW + timedelta(minutes=5)}, "prepared_at"),
        ({"donor_pickup_by": NOW + timedelta(minutes=10)}, "donor_pickup_by"),
        ({"checklist": {**CHECKLIST, "no_spoilage_signs": False}}, "checklist"),
        ({"declaration_accepted": False}, "declaration_accepted"),
        ({"pickup_lat": 51.5}, "pickup_lat"),
        ({"contact_phone": "12345"}, "contact_phone"),
        ({"storage_condition": "packaged_sealed"}, "packaged_expiry_date"),
    ],
)
def test_hard_validation(over, field):
    with pytest.raises(ValidationFailed) as e:
        validate_donation(draft(**over), now=NOW, cfg=CFG)
    assert field in e.value.details["fields"]


def test_every_flag_rule():
    ok = dict(
        photo_paths=["p.jpg"],
        quantity_servings=120,
        donor_is_verified=True,
        donor_has_open_safety_report=False,
        donor_quality_score=0.7,
    )
    assert auto_flag_reasons(**ok) == []
    assert auto_flag_reasons(**{**ok, "photo_paths": []}) == ["missing_photo"]
    assert "large_quantity" in auto_flag_reasons(**{**ok, "quantity_servings": 501})
    assert auto_flag_reasons(**{**ok, "donor_is_verified": False, "quantity_servings": 201}) == [
        "unverified_large_donor"
    ]
    assert auto_flag_reasons(**{**ok, "donor_has_open_safety_report": True}) == ["open_safety_report"]
    assert auto_flag_reasons(**{**ok, "donor_quality_score": 0.39}) == ["low_quality_donor"]


@pytest.mark.parametrize(
    "entity,table",
    [("donation", DONATION_TRANSITIONS), ("offer", OFFER_TRANSITIONS), ("allocation", ALLOCATION_TRANSITIONS)],
)
def test_state_machine_allows_listed_and_rejects_others(entity, table):
    statuses = {s for s in table if s} | {t for ts in table.values() for t in ts}
    for frm in [None, *statuses]:
        for to in statuses:
            if to in table.get(frm, set()):
                assert_transition(entity, frm, to)
            else:
                with pytest.raises(InvalidTransition):
                    assert_transition(entity, frm, to)


def test_offer_timeout_clamped():
    assert offer_timeout_minutes(NOW + timedelta(minutes=116), NOW, CFG) == 11
    assert offer_timeout_minutes(NOW + timedelta(minutes=20), NOW, CFG) == 5
    assert offer_timeout_minutes(NOW + timedelta(hours=10), NOW, CFG) == 15


def test_operating_hours_overnight_and_closed():
    hours = {"mon": {"open": "20:00", "close": "02:00"}, "tue": None}
    mon_2330 = datetime(2026, 10, 5, 23, 30, tzinfo=IST)  # Monday
    assert is_open_at(hours, mon_2330) and minutes_open_after(hours, mon_2330) == 150
    assert is_open_at(hours, datetime(2026, 10, 6, 1, 0, tzinfo=IST))  # Tue 01:00, Monday's overnight window
    assert not is_open_at(hours, datetime(2026, 10, 6, 12, 0, tzinfo=IST))
    all_day = {d: {"open": "00:00", "close": "24:00"} for d in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")}
    assert minutes_open_after(all_day, mon_2330) > 60


def test_weights_must_sum_to_one():
    validate_weights(CFG["jev_weights_default"])
    validate_weights(CFG["jev_weights_high"])
    with pytest.raises(ValidationFailed):
        validate_weights({**CFG["jev_weights_default"], "distance": 0.3})


def test_trust_formulas_prior_and_penalties():
    assert reliability_formula(
        accepted=0, offers_total=0, on_time=0, allocs_total=0, avg_rating=None, no_shows_30d=0
    ) == pytest.approx(0.7)
    assert reliability_formula(
        accepted=0, offers_total=0, on_time=0, allocs_total=0, avg_rating=None, no_shows_30d=1
    ) == pytest.approx(0.65)
    assert quality_formula(avg_rating=None, fresh_true=0, n=0, valid_reports_90d=1) == pytest.approx(0.5)
    perfect = reliability_formula(accepted=5, offers_total=5, on_time=5, allocs_total=5, avg_rating=5.0, no_shows_30d=0)
    assert perfect == pytest.approx((1.0 * 5 + 0.7 * 5) / 10)
