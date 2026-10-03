"""Internal — ARCHITECTURE §10.6. Pinged every minute by an external cron (Render free tier sleeps)."""

import hmac

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import Unauthorized
from app.services import jobs

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/tick")
def tick(x_tick_secret: str | None = Header(default=None), db: Session = Depends(get_db)):
    if not x_tick_secret or not hmac.compare_digest(x_tick_secret, get_settings().internal_tick_secret):
        raise Unauthorized("Invalid tick secret.")
    return {"ok": True, "steps": jobs.tick(db)}
