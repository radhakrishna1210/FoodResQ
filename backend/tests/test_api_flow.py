"""End-to-end API tests against real PostgreSQL — WALKTHROUGH §3, §4 acceptance, §6 edge cases."""

import threading
from datetime import timedelta

import pytest

from app.utils.serialize import iso
from app.utils.time import now_utc

pytestmark = pytest.mark.db

DONOR = "college.a@foodresq.demo"
RA, RB, RC = "receiver.a@foodresq.demo", "receiver.b@foodresq.demo", "receiver.c@foodresq.demo"
ADMIN = "admin@foodresq.demo"
CHECKLIST = {"hygienic_handling": True, "not_served_from_plates": True, "covered_containers": True,
             "segregated_from_waste": True, "no_spoilage_signs": True}


def golden_payload(**over):
    now = now_utc()
    body = dict(title="Veg pulao and dal (120 meals)", food_category="cooked_meal", diet_type="veg",
                quantity_servings=120, storage_condition="hot_held", ambient_above_32c=True,
                prepared_at=iso(now - timedelta(minutes=94)), donor_pickup_by=iso(now + timedelta(minutes=116)),
                pickup_address="Bibwewadi, Pune", pickup_lat=18.4636, pickup_lng=73.8682,
                pickup_instructions="Main canteen, gate 2", contact_phone="9000000001", checklist=CHECKLIST,
                declaration_accepted=True, photo_paths=["demo/golden.jpg"])
    body.update(over)
    return body


def post(client, as_user, **over):
    r = client.post("/api/v1/donations", json=golden_payload(**over), headers=as_user(DONOR))
    assert r.status_code == 201, r.text
    return r.json()


def pending_offer(client, as_user, email):
    items = client.get("/api/v1/offers?status=PENDING", headers=as_user(email)).json()["items"]
    return items[0] if items else None


def test_health_and_public_impact(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/v1/impact/public").json()["active_receivers"] == 3


def test_golden_flow_end_to_end(client, as_user):
    d = post(client, as_user)
    assert d["status"] == "MATCHED" and d["priority_level"] == "HIGH" and d["priority_score"] == 0.719
    assert d["pending_offers_count"] == 2

    oa, ob = pending_offer(client, as_user, RA), pending_offer(client, as_user, RB)
    assert (oa["match_score"], oa["offered_servings"], oa["rank"]) == (91, 120, 1)
    assert (ob["match_score"], ob["offered_servings"], ob["rank"]) == (52, 50, 2)

    admin_view = client.get(f"/api/v1/admin/donations/{d['id']}", headers=as_user(ADMIN)).json()
    excluded = {c["org_name"]: c["exclusion_code"] for c in admin_view["match_runs"][0]["candidates"]
                if not c["included"]}
    assert excluded["Receiver C (Demo Community Pantry)"] == "category_not_accepted"

    alloc = client.post(f"/api/v1/offers/{oa['id']}/accept", headers=as_user(RA))
    assert alloc.status_code == 200, alloc.text
    alloc = alloc.json()
    assert alloc["servings"] == 120 and len(alloc["handover_code"]) == 4

    b_after = client.get(f"/api/v1/offers/{ob['id']}", headers=as_user(RB)).json()
    assert b_after["status"] == "SUPERSEDED"
    r = client.post(f"/api/v1/offers/{ob['id']}/accept", headers=as_user(RB))
    assert r.status_code == 409 and r.json()["error"]["code"] == "OFFER_NOT_AVAILABLE"

    donor_view = client.get(f"/api/v1/donations/{d['id']}", headers=as_user(DONOR)).json()
    assert donor_view["status"] == "ACCEPTED"
    assert "handover_code" not in donor_view["allocations"][0]  # only the Receiver sees the code

    code = alloc["handover_code"]
    wrong = "0000" if code != "0000" else "1111"
    r = client.post(f"/api/v1/allocations/{alloc['id']}/handover", json={"code": wrong}, headers=as_user(DONOR))
    assert r.status_code == 422 and "4 attempts left" in r.json()["error"]["message"]
    r = client.post(f"/api/v1/allocations/{alloc['id']}/handover", json={"code": code}, headers=as_user(DONOR))
    assert r.status_code == 200 and r.json()["status"] == "COLLECTED"
    assert client.get("/api/v1/impact/public").json()["meals_rescued"] == 120

    r = client.post(f"/api/v1/allocations/{alloc['id']}/complete",
                    json={"servings_distributed": 120, "distribution_area": "Shelter, Market Yard"},
                    headers=as_user(RA))
    assert r.status_code == 200 and r.json()["status"] == "COMPLETED"
    final = client.get(f"/api/v1/donations/{d['id']}", headers=as_user(DONOR)).json()
    assert final["status"] == "COMPLETED"
    assert [t["status"] for t in final["timeline"]] == ["POSTED", "MATCHED", "ACCEPTED", "COLLECTED", "COMPLETED"]

    # Feedback + blind rule
    r = client.post(f"/api/v1/allocations/{alloc['id']}/feedback", headers=as_user(RA), json={
        "overall_rating": 5, "quantity_matched": True, "fresh_on_arrival": True, "properly_packed": True})
    assert r.status_code == 201, r.text
    donor_sees = client.get(f"/api/v1/allocations/{alloc['id']}/feedback", headers=as_user(DONOR)).json()
    assert donor_sees["theirs"] is None and donor_sees["theirs_submitted"] is True
    client.post(f"/api/v1/allocations/{alloc['id']}/feedback", headers=as_user(DONOR), json={
        "overall_rating": 5, "on_time": True, "professional": True, "proper_containers": True})
    donor_sees = client.get(f"/api/v1/allocations/{alloc['id']}/feedback", headers=as_user(DONOR)).json()
    assert donor_sees["theirs"]["overall_rating"] == 5
    r = client.post(f"/api/v1/allocations/{alloc['id']}/feedback", headers=as_user(DONOR), json={"overall_rating": 4})
    assert r.status_code == 409

    csv = client.get(f"/api/v1/donations/{d['id']}/record.csv", headers=as_user(DONOR))
    assert csv.status_code == 200
    header = csv.text.lstrip("﻿").splitlines()[0]
    assert header.split(",")[0] == "donor_name_address" and "distribution_date" in header
    assert "120 servings" in csv.text and "Shelter, Market Yard" in csv.text


def test_b_accepts_first_split_allocation(client, as_user):
    d = post(client, as_user)
    oa, ob = pending_offer(client, as_user, RA), pending_offer(client, as_user, RB)
    assert client.post(f"/api/v1/offers/{ob['id']}/accept", headers=as_user(RB)).json()["servings"] == 50
    assert client.get(f"/api/v1/offers/{oa['id']}", headers=as_user(RA)).json()["offered_servings"] == 70
    assert client.post(f"/api/v1/offers/{oa['id']}/accept", headers=as_user(RA)).json()["servings"] == 70
    view = client.get(f"/api/v1/donations/{d['id']}", headers=as_user(DONOR)).json()
    assert view["status"] == "ACCEPTED" and len(view["allocations"]) == 2


def test_concurrent_accepts_one_wins(client, as_user):
    post(client, as_user)
    oa, ob = pending_offer(client, as_user, RA), pending_offer(client, as_user, RB)
    ha, hb = as_user(RA), as_user(RB)
    results = {}

    def go(name, offer, headers):
        results[name] = client.post(f"/api/v1/offers/{offer['id']}/accept", headers=headers)

    ts = [threading.Thread(target=go, args=("a", oa, ha)), threading.Thread(target=go, args=("b", ob, hb))]
    [t.start() for t in ts]
    [t.join() for t in ts]
    codes = sorted(r.status_code for r in results.values())
    total = sum(r.json()["servings"] for r in results.values() if r.status_code == 200)
    # Either A wins all 120 (B gets 409) or B takes 50 first and A takes the remaining 70.
    assert (codes == [200, 409] and total == 120) or (codes == [200, 200] and total == 120)


def test_decline_cascade_widens_radius_and_alerts_once(client, as_user):
    d = post(client, as_user)
    for email in (RA, RB):
        o = pending_offer(client, as_user, email)
        r = client.post(f"/api/v1/offers/{o['id']}/decline", json={"reason_code": "no_vehicle_now"},
                        headers=as_user(email))
        assert r.status_code == 200, r.text
    admin_view = client.get(f"/api/v1/admin/donations/{d['id']}", headers=as_user(ADMIN)).json()
    assert admin_view["status"] == "POSTED"
    radii = [float(r["search_radius_km"]) for r in admin_view["match_runs"]]
    assert radii[-3:] == [10.0, 15.0, 20.0]
    notifs = client.get("/api/v1/notifications", headers=as_user(DONOR)).json()["items"]
    assert sum(1 for n in notifs if n["type"] == "NO_MATCH_ALERT") == 1
    client.post("/api/v1/internal/tick", headers={"X-Tick-Secret": "change-me"})
    notifs = client.get("/api/v1/notifications", headers=as_user(DONOR)).json()["items"]
    assert sum(1 for n in notifs if n["type"] == "NO_MATCH_ALERT") == 1


def test_tick_idempotent_and_secret(client):
    assert client.post("/api/v1/internal/tick", headers={"X-Tick-Secret": "nope"}).status_code == 401
    r1 = client.post("/api/v1/internal/tick", headers={"X-Tick-Secret": "change-me"})
    r2 = client.post("/api/v1/internal/tick", headers={"X-Tick-Secret": "change-me"})
    assert r1.status_code == r2.status_code == 200
    assert all(v == 0 for v in r2.json()["steps"].values())


def test_handover_lock_and_admin_override(client, as_user):
    post(client, as_user)
    oa = pending_offer(client, as_user, RA)
    alloc = client.post(f"/api/v1/offers/{oa['id']}/accept", headers=as_user(RA)).json()
    wrong = "0000" if alloc["handover_code"] != "0000" else "1111"
    for _ in range(5):
        r = client.post(f"/api/v1/allocations/{alloc['id']}/handover", json={"code": wrong}, headers=as_user(DONOR))
    assert r.json()["error"]["code"] == "HANDOVER_LOCKED"
    r = client.post(f"/api/v1/allocations/{alloc['id']}/handover", json={"code": alloc["handover_code"]},
                    headers=as_user(DONOR))
    assert r.status_code == 409
    admin_n = client.get("/api/v1/notifications", headers=as_user(ADMIN)).json()["items"]
    assert any(n["type"] == "HANDOVER_LOCKED" for n in admin_n)
    r = client.post(f"/api/v1/admin/allocations/{alloc['id']}/override-collect",
                    json={"reason": "Called both parties"}, headers=as_user(ADMIN))
    assert r.status_code == 200 and r.json()["status"] == "COLLECTED"


def test_flagged_missing_photo_approve_and_reject(client, as_user):
    d = post(client, as_user, photo_paths=[])
    assert d["status"] == "FLAGGED" and d["flag_reasons"] == ["missing_photo"]
    r = client.post(f"/api/v1/admin/donations/{d['id']}/approve", headers=as_user(ADMIN))
    assert r.json()["status"] == "MATCHED"
    d2 = post(client, as_user, photo_paths=[], title="Second flagged post")
    r = client.post(f"/api/v1/admin/donations/{d2['id']}/reject", json={"reason": "Unclear food"},
                    headers=as_user(ADMIN))
    assert r.json()["status"] == "CANCELLED"


def test_validation_rules(client, as_user):
    bad = {**CHECKLIST, "covered_containers": False}
    r = client.post("/api/v1/donations", json=golden_payload(checklist=bad), headers=as_user(DONOR))
    assert r.status_code == 422 and "checklist.covered_containers" in r.json()["error"]["details"]["fields"]
    now = now_utc()
    r = client.post("/api/v1/donations", headers=as_user(DONOR), json=golden_payload(
        storage_condition="room_temp", ambient_above_32c=True, prepared_at=iso(now - timedelta(minutes=40)),
        donor_pickup_by=iso(now + timedelta(hours=3))))
    assert r.status_code == 422
    assert r.json()["error"]["message"] == "This food is too close to its safe limit to be rescued safely."


def test_rbac(client, as_user):
    assert client.get("/api/v1/offers", headers=as_user(DONOR)).status_code == 403
    assert client.get("/api/v1/admin/overview", headers=as_user(DONOR)).status_code == 403
    pend = as_user("receiver.pending@foodresq.demo")
    assert client.get("/api/v1/offers", headers=pend).status_code == 403
    assert client.get("/api/v1/me", headers=pend).json()["user"]["account_status"] == "pending_verification"
    assert client.get("/api/v1/me").status_code == 401


def test_admin_weights_must_sum_to_one(client, as_user):
    bad = {"distance": 0.5, "capacity": 0.2, "feasibility": 0.15, "demand": 0.15, "reliability": 0.1, "diet": 0.1,
           "availability": 0.1}
    r = client.put("/api/v1/admin/config", json={"jev_weights_default": bad}, headers=as_user(ADMIN))
    assert r.status_code == 422


def test_verification_and_reverify(client, as_user, seeded):
    pend_id = str(seeded["receiver.pending@foodresq.demo"])
    r = client.post(f"/api/v1/admin/users/{pend_id}/verify", headers=as_user(ADMIN))
    assert r.json()["account_status"] == "active"
    pend = as_user("receiver.pending@foodresq.demo")
    assert client.get("/api/v1/offers", headers=pend).status_code == 200
    r = client.patch("/api/v1/receiver/profile", json={"fssai_registration_no": "10012345000099"}, headers=pend)
    assert r.json()["account_status"] == "pending_verification"


def test_receiver_cancel_rematches_and_excludes_superseded(client, as_user):
    d = post(client, as_user)
    oa = pending_offer(client, as_user, RA)
    alloc = client.post(f"/api/v1/offers/{oa['id']}/accept", headers=as_user(RA)).json()
    r = client.post(f"/api/v1/allocations/{alloc['id']}/cancel", json={"reason": "vehicle broke down"},
                    headers=as_user(RA))
    assert r.status_code == 200 and r.json()["status"] == "CANCELLED"
    view = client.get(f"/api/v1/donations/{d['id']}", headers=as_user(DONOR)).json()
    assert view["remaining_servings"] == 120 and view["status"] == "POSTED"
    assert pending_offer(client, as_user, RB) is None  # B was SUPERSEDED → already_offered


def test_chat_only_for_parties(client, as_user):
    post(client, as_user)
    oa = pending_offer(client, as_user, RA)
    alloc = client.post(f"/api/v1/offers/{oa['id']}/accept", headers=as_user(RA)).json()
    assert client.post(f"/api/v1/allocations/{alloc['id']}/messages", json={"body": "On our way"},
                       headers=as_user(RA)).status_code == 201
    assert client.get(f"/api/v1/allocations/{alloc['id']}/messages", headers=as_user(RB)).status_code == 404
    msgs = client.get(f"/api/v1/allocations/{alloc['id']}/messages", headers=as_user(DONOR)).json()
    assert msgs["items"][0]["body"] == "On our way" and msgs["open"] is True


def test_assistant_unavailable_without_key(client, as_user):
    r = client.post("/api/v1/assistant/chat", json={"message": "Where is my donation?"}, headers=as_user(DONOR))
    assert r.status_code == 200 and r.json()["reply"] == "Assistant is unavailable right now."
