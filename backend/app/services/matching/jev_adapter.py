"""Optional alternative Stage-2 scorer: TypeSafe AI's Jev (README decisions log).

Bridge (this project's own deterministic weighted formula in scoring.py) is the default and the only
engine the automated test suite assumes — including the golden-demo test's exact scores (A=91, B=52).
Setting MATCHING_ENGINE=jev switches the final 0-100 match score to come from TypeSafe's Jev API
instead, using the same factor measurements Bridge itself computes (distance/capacity/diet/demand/
availability/feasibility/reliability). Stage 1 hard filters and the factor measurements themselves are
never delegated — only the final scoring judgment is, and only when explicitly turned on.

Jev is an early-access, no-SLA third-party product (launched Sep 2026) with no formal integration
test run against a real API key at implementation time — this adapter was built from TypeSafe's
publicly documented OpenAI-compatible access path (api.aimlapi.com, model "typesafe/jev"), not against
a live account. Any failure, timeout, or unparseable response returns None so the caller falls back to
Bridge's own formula for that candidate; a Jev outage or an API shape mismatch can never block
matching. TODO(team): verify this adapter end-to-end against a real TypeSafe/aimlapi key before
relying on it for anything beyond experimentation, and adjust the request/response shape below if
TypeSafe's actual contract differs from what's assumed here.
"""

import json
import logging

import httpx

from app.config import get_settings

log = logging.getLogger("foodresq.matching.jev")

JEV_API_URL = "https://api.aimlapi.com/v1/chat/completions"
JEV_MODEL = "typesafe/jev"
JEV_TIMEOUT_SECONDS = 4.0

_PROMPT = (
    "You are scoring how good a match a food-rescue Receiver is for a surplus-food donation, for a "
    "ranking decision. You will be given 0-1 factor measurements (already computed; do not recompute "
    "them). Combine them into a single overall match quality judgement.\n"
    "Respond with ONLY a JSON object of the exact shape {{\"score\": <integer 0-100>}} — no other text.\n"
    "Receiver: {org_name}, distance_km={distance_km}, eta_minutes={eta_minutes}\n"
    "Factors (0-1 each): {factors_json}"
)


def score_via_jev(factors: dict[str, float], *, org_name: str, distance_km: float, eta_minutes: int) -> int | None:
    """Returns a 0-100 integer match score from Jev, or None if anything goes wrong — the caller
    (ranking.evaluate) falls back to Bridge's own match_score() formula in that case."""
    s = get_settings()
    if not s.typesafe_jev_api_key:
        return None
    prompt = _PROMPT.format(
        org_name=org_name,
        distance_km=distance_km,
        eta_minutes=eta_minutes,
        factors_json=json.dumps({k: round(v, 4) for k, v in factors.items()}),
    )
    try:
        res = httpx.post(
            JEV_API_URL,
            headers={"Authorization": f"Bearer {s.typesafe_jev_api_key}", "Content-Type": "application/json"},
            json={"model": JEV_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 50},
            timeout=JEV_TIMEOUT_SECONDS,
        )
        res.raise_for_status()
        content = res.json()["choices"][0]["message"]["content"]
        score = int(json.loads(content)["score"])
        return max(0, min(100, score))
    except Exception:
        log.warning("Jev scoring failed; falling back to Bridge for this candidate", exc_info=True)
        return None
