"""Assistant chat loop — ARCHITECTURE §11.1.

Loads the last 20 messages of the conversation, calls the Google Gemini API (Google AI Studio) with the
system prompt and role-specific tools, executes tool calls as the current user, loops until a final text
answer (max 4 tool rounds), stores messages, and returns {conversation_id, reply, draft?}. If the API key
is missing or the call fails, returns a friendly fallback; the rest of the app keeps working.
"""

import json
import logging
import uuid
from functools import lru_cache
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AssistantMessage, DonorProfile, ReceiverProfile, User
from app.services.assistant.prompt import build_system_prompt
from app.services.assistant.tools import gemini_tools_for_role, run_tool
from app.utils.time import now_utc, to_ist

log = logging.getLogger("foodresq.assistant")
UNAVAILABLE = "Assistant is unavailable right now."
BLOCKED_FINISH_REASONS = {"SAFETY", "PROHIBITED_CONTENT", "RECITATION", "BLOCKLIST"}
MAX_TOOL_ROUNDS = 4
HISTORY_LIMIT = 20
ROLE_TO_GEMINI = {"user": "user", "assistant": "model"}


@lru_cache
def _client():
    s = get_settings()
    if not s.gemini_api_key or not s.gemini_model:
        return None
    from google import genai

    return genai.Client(api_key=s.gemini_api_key)


def _org_name(db: Session, user: User) -> str:
    p = db.get(DonorProfile if user.role == "donor" else ReceiverProfile, user.id)
    return p.org_name if p else user.full_name


def _history(db: Session, user: User, conversation_id: uuid.UUID) -> list[dict[str, Any]]:
    """Text-only user/assistant turns (tool rounds are stored for audit but not replayed)."""
    rows = db.execute(select(AssistantMessage).where(
        AssistantMessage.user_id == user.id, AssistantMessage.conversation_id == conversation_id,
        AssistantMessage.role.in_(["user", "assistant"])).order_by(AssistantMessage.created_at.desc())
        .limit(HISTORY_LIMIT)).scalars().all()
    msgs = [{"role": r.role, "content": r.content.get("text", "")} for r in reversed(rows)]
    while msgs and msgs[0]["role"] != "user":
        msgs.pop(0)
    return msgs


def _store(db: Session, user: User, conversation_id: uuid.UUID, role: str, content: dict) -> None:
    db.add(AssistantMessage(user_id=user.id, conversation_id=conversation_id, role=role, content=content))


def _initial_contents(history: list[dict[str, Any]], message: str) -> list[Any]:
    from google.genai import types

    contents = [types.Content(role=ROLE_TO_GEMINI[m["role"]], parts=[types.Part(text=m["content"])])
                for m in history]
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))
    return contents


def chat(db: Session, user: User, message: str, conversation_id: uuid.UUID | None) -> dict[str, Any]:
    conversation_id = conversation_id or uuid.uuid4()
    client = _client()
    if client is None:
        return {"conversation_id": str(conversation_id), "reply": UNAVAILABLE, "draft": None, "available": False}

    from google.genai import errors, types

    now_ist = to_ist(now_utc())
    system = build_system_prompt(user.role, _org_name(db, user), now_ist.strftime("%d %B %Y"),
                                 now_ist.strftime("%I:%M %p"))
    contents = _initial_contents(_history(db, user, conversation_id), message)
    _store(db, user, conversation_id, "user", {"text": message})
    config = types.GenerateContentConfig(system_instruction=system, tools=gemini_tools_for_role(user.role),
                                          max_output_tokens=4096)
    draft: dict | None = None
    reply = ""

    try:
        for _ in range(MAX_TOOL_ROUNDS + 1):
            response = client.models.generate_content(model=get_settings().gemini_model, contents=contents,
                                                       config=config)
            candidate = response.candidates[0] if response.candidates else None
            if candidate is None or candidate.finish_reason in BLOCKED_FINISH_REASONS:
                reply = "I can't help with that. Please use the app screens or contact the FoodResQ team."
                break
            parts = candidate.content.parts or []
            calls = [p.function_call for p in parts if p.function_call]
            if not calls:
                reply = "".join(p.text for p in parts if p.text).strip()
                break
            contents.append(candidate.content)
            response_parts = []
            for call in calls:
                result, maybe_draft = run_tool(db, user, call.name, dict(call.args or {}))
                draft = maybe_draft or draft
                payload = result if isinstance(result, str) else json.dumps(result, default=str)
                response_parts.append(types.Part.from_function_response(name=call.name, response={"result": payload}))
                _store(db, user, conversation_id, "tool", {"name": call.name, "input": dict(call.args or {})})
            contents.append(types.Content(role="user", parts=response_parts))
        else:
            reply = "Sorry, that took too many steps. Please try a simpler question."
    except errors.APIError:
        log.exception("assistant call failed")
        return {"conversation_id": str(conversation_id), "reply": UNAVAILABLE, "draft": None, "available": False}

    reply = reply or "I don't have an answer for that."
    _store(db, user, conversation_id, "assistant", {"text": reply})
    return {"conversation_id": str(conversation_id), "reply": reply, "draft": draft, "available": True}
