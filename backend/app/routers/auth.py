"""Auth / account — ARCHITECTURE §10.1 (+ prototype-only dev login)."""

import uuid

from fastapi import APIRouter, Depends, Request
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import AuthContext, get_auth, get_current_user, mint_dev_token
from app.config import get_settings
from app.db import get_db
from app.errors import Forbidden, NotFound, ValidationFailed
from app.models import User
from app.schemas.requests import (
    DevLoginIn,
    DonorProfileIn,
    MePatch,
    OnboardingIn,
    ReceiverProfileIn,
)
from app.services import accounts, ratelimit
from app.services.views import profile_dict, user_dict

router = APIRouter(tags=["auth"])


@router.get("/me")
def get_me(ctx: AuthContext = Depends(get_auth), db: Session = Depends(get_db)):
    if ctx.user is None:
        return {"onboarded": False, "email": ctx.email}
    return {"onboarded": True, "user": user_dict(ctx.user), "profile": profile_dict(db, ctx.user)}


@router.post("/onboarding", status_code=201)
def onboarding(body: OnboardingIn, request: Request, ctx: AuthContext = Depends(get_auth),
               db: Session = Depends(get_db)):
    ratelimit.check("auth", request.client.host if request.client else "unknown")
    if body.role == "admin":
        raise Forbidden("Admin accounts can't be created through signup.")
    if not ctx.email:
        raise ValidationFailed("Your account has no email address.")
    schema = DonorProfileIn if body.role == "donor" else ReceiverProfileIn
    try:
        profile = TypeAdapter(schema).validate_python(body.profile)
    except ValidationError as exc:
        fields = {".".join(str(p) for p in e["loc"]): e["msg"] for e in exc.errors()}
        raise ValidationFailed("Please check the highlighted fields.", details={"fields": fields}) from exc
    user = accounts.onboard(db, ctx.auth_user_id, ctx.email, {**body.model_dump(), "profile": profile.model_dump()})
    return {"onboarded": True, "user": user_dict(user), "profile": profile_dict(db, user)}


@router.patch("/me")
def patch_me(body: MePatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    accounts.update_me(db, user, body.model_dump(exclude_none=True))
    return {"onboarded": True, "user": user_dict(user), "profile": profile_dict(db, user)}


@router.post("/dev/login", include_in_schema=False)
def dev_login(body: DevLoginIn, request: Request, db: Session = Depends(get_db)):
    """TODO(team): prototype-only. Enabled only when DEV_AUTH_ENABLED=true. Remove before any pilot."""
    if not get_settings().dev_auth_enabled:
        raise NotFound("Not found.")
    ratelimit.check("auth", request.client.host if request.client else "unknown")
    email = body.email.lower()
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    # Unknown email → a fresh, not-yet-onboarded identity (same id the seed would use), so the
    # demo signup → onboarding path works without Supabase Auth.
    user_id = user.id if user else uuid.uuid5(uuid.NAMESPACE_URL, f"foodresq-demo:{email}")
    return {"access_token": mint_dev_token(user_id, email), "token_type": "bearer", "onboarded": user is not None}
