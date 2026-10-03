"""AI assistant — ARCHITECTURE §11 (Phase 6). Donors and active Receivers only."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_active_role
from app.db import get_db
from app.models import User
from app.schemas.requests import AssistantChatIn
from app.services import ratelimit
from app.services.assistant.service import chat

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat")
def assistant_chat(body: AssistantChatIn, user: User = Depends(require_active_role("donor", "receiver")),
                   db: Session = Depends(get_db)):
    ratelimit.check("assistant", str(user.id))
    return chat(db, user, body.message, body.conversation_id)
