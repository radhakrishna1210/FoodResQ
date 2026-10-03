"""Assistant chat loop — ARCHITECTURE §11.1.

Loads the last 20 messages of the conversation, calls the Anthropic Messages API with the system prompt
and role-specific tools, executes tool calls as the current user, loops until a final text answer (max 4
tool rounds), stores messages, and returns {conversation_id, reply, draft?}. If the API key is missing or
the call fails, returns a friendly fallback; the rest of the app keeps working.
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
from app.services.assistant.tools import run_tool, tools_for_role
from app.utils.time import now_utc, to_ist

log = logging.getLogger("foodresq.assistant")
UNAVAILABLE = "Assistant is unavailable right now."
MAX_TOOL_ROUNDS = 4
HISTORY_LIMIT = 20


@lru_cache
def _client():
    s = get_settings()
    if not s.anthropic_api_key or not s.anthropic_model:
        return None
    import anthropic

    return anthropic.Anthropic(api_key=s.anthropic_api_key)


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


def chat(db: Session, user: User, message: str, conversation_id: uuid.UUID | None) -> dict[str, Any]:
    conversation_id = conversation_id or uuid.uuid4()
    client = _client()
    if client is None:
        return {"conversation_id": str(conversation_id), "reply": UNAVAILABLE, "draft": None, "available": False}

    now_ist = to_ist(now_utc())
    system = build_system_prompt(user.role, _org_name(db, user), now_ist.strftime("%d %B %Y"),
                                 now_ist.strftime("%I:%M %p"))
    messages: list[dict[str, Any]] = _history(db, user, conversation_id) + [{"role": "user", "content": message}]
    _store(db, user, conversation_id, "user", {"text": message})
    tools = tools_for_role(user.role)
    draft: dict | None = None
    reply = ""

    try:
        import anthropic

        for _ in range(MAX_TOOL_ROUNDS + 1):
            response = client.messages.create(model=get_settings().anthropic_model, max_tokens=4096,
                                              system=system, tools=tools, messages=messages)
            if response.stop_reason == "refusal":
                reply = "I can't help with that. Please use the app screens or contact the FoodResQ team."
                break
            if response.stop_reason != "tool_use":
                reply = "".join(b.text for b in response.content if b.type == "text").strip()
                break
            messages.append({"role": "assistant", "content": response.content})
            results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                result, maybe_draft = run_tool(db, user, block.name, dict(block.input or {}))
                draft = maybe_draft or draft
                results.append({"type": "tool_result", "tool_use_id": block.id,
                                "content": result if isinstance(result, str) else json.dumps(result, default=str),
                                "is_error": isinstance(result, dict) and "error" in result})
                _store(db, user, conversation_id, "tool", {"name": block.name, "input": block.input})
            messages.append({"role": "user", "content": results})
        else:
            reply = "Sorry, that took too many steps. Please try a simpler question."
    except anthropic.APIError:
        log.exception("assistant call failed")
        return {"conversation_id": str(conversation_id), "reply": UNAVAILABLE, "draft": None, "available": False}

    reply = reply or "I don't have an answer for that."
    _store(db, user, conversation_id, "assistant", {"text": reply})
    return {"conversation_id": str(conversation_id), "reply": reply, "draft": draft, "available": True}
