"""Assistant tools — ARCHITECTURE §11.2. All read-only except draft_donation, which saves nothing.

Every tool runs AS the current user with the same ownership checks as the API: ids that belong to
another user return "not found".
"""

import re
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Allocation, Donation, MatchRun, Offer, User
from app.services import donations as donation_svc
from app.services import offers as offer_svc
from app.services.views import allocation_dict, donation_detail, donation_summary, offer_dict, profile_dict
from app.utils.time import IST, now_utc, to_ist

HELP_DIR = Path(__file__).parent / "help"
HELP_TOPICS = ("posting", "safety_checklist", "flags", "matching", "handover", "feedback", "verification")
CHECKLIST_KEYS = (
    "hygienic_handling",
    "not_served_from_plates",
    "covered_containers",
    "segregated_from_waste",
    "no_spoilage_signs",
)


def _obj(props: dict, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": props, "required": required or [], "additionalProperties": False}


TOOL_DEFS: dict[str, dict[str, Any]] = {
    "get_my_profile": {
        "roles": {"donor", "receiver"},
        "description": "Get the current user's profile summary.",
        "input_schema": _obj({}),
    },
    "list_my_donations": {
        "roles": {"donor"},
        "description": "List the donor's recent donations.",
        "input_schema": _obj({"status": {"type": "string", "description": "Optional status filter"}}),
    },
    "get_donation_status": {
        "roles": {"donor"},
        "description": "Status, timeline, allocations and ETA of a donation.",
        "input_schema": _obj({"donation_id": {"type": "string"}}, ["donation_id"]),
    },
    "get_match_explanation": {
        "roles": {"donor"},
        "description": "Latest JEV match run for a donation: top scores and reasons.",
        "input_schema": _obj({"donation_id": {"type": "string"}}, ["donation_id"]),
    },
    "list_my_offers": {
        "roles": {"receiver"},
        "description": "Pending offers with score, reasons and deadline.",
        "input_schema": _obj({}),
    },
    "explain_offer": {
        "roles": {"receiver"},
        "description": "Factor breakdown of one offer in plain language.",
        "input_schema": _obj({"offer_id": {"type": "string"}}, ["offer_id"]),
    },
    "list_my_allocations": {
        "roles": {"receiver"},
        "description": "Active and recent pickups.",
        "input_schema": _obj({"status": {"type": "string"}}),
    },
    "get_help_article": {
        "roles": {"donor", "receiver"},
        "description": "Read a FoodResQ help article.",
        "input_schema": _obj({"topic": {"type": "string", "enum": list(HELP_TOPICS)}}, ["topic"]),
    },
    "draft_donation": {
        "roles": {"donor"},
        "description": "Turn the donor's free text into a DRAFT of the donation form for them to "
        "review. Saves nothing. Never fills storage condition, checklist or "
        "declaration.",
        "input_schema": _obj(
            {
                "title": {"type": "string"},
                "food_category": {
                    "type": "string",
                    "enum": ["cooked_meal", "bakery", "sweets", "dairy", "raw_produce", "packaged"],
                },
                "diet_type": {"type": "string", "enum": ["veg", "egg", "non_veg"]},
                "quantity_servings": {"type": "integer"},
                "prepared_at_ist": {"type": "string", "description": "HH:MM today, IST"},
                "donor_pickup_by_ist": {"type": "string", "description": "HH:MM today, IST"},
                "description": {"type": "string"},
            },
            ["title"],
        ),
    },
}


def tools_for_role(role: str) -> list[dict[str, Any]]:
    return [
        {"name": n, "description": d["description"], "input_schema": d["input_schema"]}
        for n, d in TOOL_DEFS.items()
        if role in d["roles"]
    ]


def _uuid(v: Any) -> uuid.UUID:
    try:
        return uuid.UUID(str(v))
    except ValueError as exc:
        raise AppError("Not found.", code="NOT_FOUND", status_code=404) from exc


def _hhmm_today(v: str | None) -> str | None:
    if not v or not re.fullmatch(r"([01]?\d|2[0-3]):[0-5]\d", v.strip()):
        return None
    h, m = map(int, v.strip().split(":"))
    local = to_ist(now_utc()).replace(hour=h, minute=m, second=0, microsecond=0)
    return local.astimezone(IST).isoformat()


def run_tool(db: Session, user: User, name: str, args: dict[str, Any]) -> tuple[Any, dict | None]:
    """Returns (result for the model, draft for the frontend or None)."""
    spec = TOOL_DEFS.get(name)
    if spec is None or user.role not in spec["roles"]:
        return {"error": "This tool isn't available for your role."}, None
    try:
        if name == "get_my_profile":
            return {
                "role": user.role,
                "full_name": user.full_name,
                "account_status": user.account_status,
                "profile": profile_dict(db, user),
            }, None
        if name == "list_my_donations":
            stmt = select(Donation).where(Donation.donor_id == user.id).order_by(Donation.posted_at.desc()).limit(10)
            if args.get("status"):
                stmt = stmt.where(Donation.status == args["status"])
            return [
                {
                    k: s[k]
                    for k in (
                        "id",
                        "title",
                        "status",
                        "quantity_servings",
                        "remaining_servings",
                        "effective_deadline",
                        "priority_level",
                    )
                }
                for s in (donation_summary(db, d, include_photos=False) for d in db.execute(stmt).scalars())
            ], None
        if name == "get_donation_status":
            d = donation_svc.get_owned_donation(db, _uuid(args.get("donation_id")), user)
            full = donation_detail(db, d, user)
            return {
                k: full[k]
                for k in (
                    "title",
                    "status",
                    "quantity_servings",
                    "remaining_servings",
                    "effective_deadline",
                    "timeline",
                    "pending_offers_count",
                )
            } | {
                "allocations": [
                    {k: a.get(k) for k in ("receiver_org_name", "servings", "status", "eta_at", "accepted_at")}
                    for a in full["allocations"]
                ]
            }, None
        if name == "get_match_explanation":
            d = donation_svc.get_owned_donation(db, _uuid(args.get("donation_id")), user)
            run = (
                db.execute(
                    select(MatchRun)
                    .where(MatchRun.donation_id == d.id, MatchRun.trigger != "radius_widened")
                    .order_by(MatchRun.run_at.desc())
                    .limit(1)
                ).scalar_one_or_none()
                or db.execute(
                    select(MatchRun).where(MatchRun.donation_id == d.id).order_by(MatchRun.run_at.desc()).limit(1)
                ).scalar_one_or_none()
            )
            if run is None:
                return {"message": "No match run yet."}, None
            accepted = {
                str(r)
                for r in db.execute(
                    select(Allocation.receiver_id).where(
                        Allocation.donation_id == d.id, Allocation.status != "CANCELLED"
                    )
                ).scalars()
            }
            out = []
            for c in run.candidates:
                visible = c["receiver_id"] in accepted  # names only for accepted Receivers
                out.append(
                    {
                        "receiver": c["org_name"] if visible else f"Receiver ranked {c.get('rank') or '-'}",
                        "included": c["included"],
                        "match_score": c.get("match_score"),
                        "reasons": c.get("reasons"),
                        "distance_km": c.get("distance_km"),
                        "eta_minutes": c.get("eta_minutes"),
                        "excluded_because": c.get("exclusion_code"),
                    }
                )
            return {"search_radius_km": float(run.search_radius_km), "candidates": out}, None
        if name == "list_my_offers":
            rows = db.execute(
                select(Offer).where(Offer.receiver_id == user.id, Offer.status == "PENDING").order_by(Offer.expires_at)
            ).scalars()
            return [
                {
                    "offer_id": str(o.id),
                    "food": o_d["donation"]["title"],
                    "servings": o.offered_servings,
                    "match_score": o.match_score,
                    "reasons": o.reasons,
                    "respond_by": o_d["expires_at"],
                    "pickup_by": o_d["donation"]["effective_deadline"],
                }
                for o, o_d in ((o, offer_dict(db, o)) for o in rows)
            ], None
        if name == "explain_offer":
            o = offer_svc.get_owned_offer(db, _uuid(args.get("offer_id")), user)
            return {
                "match_score": o.match_score,
                "factors": o.factor_scores,
                "reasons": o.reasons,
                "distance_km": float(o.distance_km),
                "eta_minutes": o.eta_minutes,
                "offered_servings": o.offered_servings,
            }, None
        if name == "list_my_allocations":
            stmt = (
                select(Allocation)
                .where(Allocation.receiver_id == user.id)
                .order_by(Allocation.accepted_at.desc())
                .limit(10)
            )
            if args.get("status"):
                stmt = stmt.where(Allocation.status == args["status"])
            return [
                {
                    k: a.get(k)
                    for k in (
                        "id",
                        "status",
                        "servings",
                        "donor_org_name",
                        "eta_at",
                        "effective_deadline",
                        "pickup_address",
                    )
                }
                for a in (allocation_dict(db, x, user) for x in db.execute(stmt).scalars())
            ], None
        if name == "get_help_article":
            topic = args.get("topic")
            if topic not in HELP_TOPICS:
                return {"error": "Unknown topic."}, None
            return (HELP_DIR / f"{topic}.md").read_text(encoding="utf-8"), None
        if name == "draft_donation":
            draft = {
                "title": (args.get("title") or "")[:80],
                "food_category": args.get("food_category"),
                "diet_type": args.get("diet_type"),
                "quantity_servings": args.get("quantity_servings"),
                "prepared_at": _hhmm_today(args.get("prepared_at_ist")),
                "donor_pickup_by": _hhmm_today(args.get("donor_pickup_by_ist")),
                "description": args.get("description"),
                "storage_condition": None,  # always chosen by the user
                "checklist": {k: False for k in CHECKLIST_KEYS},  # always unchecked
                "declaration_accepted": False,
            }
            return {"draft_prepared": True, "note": "Draft opened for the donor to review. Nothing was saved."}, draft
    except AppError as exc:
        return {"error": exc.message}, None
    return {"error": "Unknown tool."}, None
