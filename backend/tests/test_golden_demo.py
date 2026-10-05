"""Golden demo — WALKTHROUGH §3 / ARCHITECTURE §19. These exact numbers must hold."""

from datetime import timedelta

from app.services.app_config import DEFAULT_CONFIG as CFG
from app.services.deadlines import compute_deadlines
from app.services.matching.ranking import batch_size, evaluate, offer_timeout_minutes
from app.services.priority import compute_priority
from app.utils.time import to_ist
from tests.fixtures import (
    NOW,
    PICKUP_BY,
    PREPARED_AT,
    RECEIVER_A_ID,
    RECEIVER_B_ID,
    RECEIVER_C_ID,
    TODAY,
    golden_donation,
    golden_receivers,
)


def _deadlines():
    return compute_deadlines(storage_condition="hot_held", ambient_above_32c=True, prepared_at=PREPARED_AT,
                             packaged_expiry_date=None, donor_pickup_by=PICKUP_BY, cfg=CFG)


def test_step2_deadlines():
    # hot_held safe window is now 6h (was 4h) and the post-pickup consumption buffer (4h) is added
    # after the safe deadline rather than subtracted before it (0003_pickup_windows). The donor's own
    # pickup_by (10:30 PM) is still earlier than the new, later safe deadline (1:00 AM), so it's still
    # the one that binds — effective_deadline is unchanged.
    d = _deadlines()
    assert to_ist(d.safe_pickup_deadline).strftime("%H:%M") == "01:00"
    assert to_ist(d.effective_deadline).strftime("%H:%M") == "22:30"
    assert to_ist(d.last_consumption_at).strftime("%H:%M") == "05:00"
    assert d.effective_deadline - PREPARED_AT == timedelta(hours=3, minutes=30)


def test_step3_priority_high_0719():
    p = compute_priority(effective_deadline=_deadlines().effective_deadline, remaining_servings=120,
                         food_category="cooked_meal", now=NOW, cfg=CFG)
    assert str(p.stored_score) == "0.719"
    assert p.level == "HIGH"


def test_step4_jev_scores():
    weights, cands = evaluate(golden_donation(), golden_receivers(), now=NOW, today_ist=TODAY, cfg=CFG)
    assert weights == CFG["jev_weights_high"]
    by_id = {c.receiver_id: c for c in cands}
    a, b, c = by_id[RECEIVER_A_ID], by_id[RECEIVER_B_ID], by_id[RECEIVER_C_ID]

    assert (a.distance_km, a.eta_minutes) == (1.9, 21)
    assert (b.distance_km, b.eta_minutes) == (8.9, 42)
    # TODO(team): WALKTHROUGH §3.5 lists C's ETA as 24 min, but the §7.2 formula gives
    # ceil(15 + 3.1 / 20 × 60) = ceil(24.3) = 25. C is excluded, so no score is affected.
    assert (c.distance_km, c.eta_minutes) == (3.1, 25)

    assert a.included and a.match_score == 91 and a.rank == 1
    assert b.included and b.match_score == 52 and b.rank == 2
    assert not c.included and c.exclusion_code == "category_not_accepted"

    assert round(a.factors["distance"], 2) == 0.81
    assert round(a.factors["feasibility"], 3) == 0.819
    assert round(b.factors["capacity"], 2) == 0.42
    assert round(b.factors["feasibility"], 3) == 0.638
    assert b.factors["demand"] == 0.5

    assert a.reasons == ["Very close: 1.9 km (about 21 min)", "Can take all 120 servings",
                         "Arrives well before the deadline"]
    assert b.reasons == ["Best available option nearby", "Partial fit: can take 50 of 120 servings"]


def test_step6_offers():
    deadline = _deadlines().effective_deadline
    assert offer_timeout_minutes(deadline, NOW, CFG) == 11
    assert batch_size("HIGH", CFG) == 2
    _, cands = evaluate(golden_donation(), golden_receivers(), now=NOW, today_ist=TODAY, cfg=CFG)
    top = [c for c in cands if c.included][:2]
    assert [min(c.capacity_available, 120) for c in top] == [120, 50]
