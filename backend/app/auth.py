"""Authentication & authorization — ARCHITECTURE §3.

The role is read from our `users` table, never from the token or the request body.
"""

import uuid
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import Forbidden, Unauthorized
from app.models import User

DEV_ISSUER = "foodresq-dev"


@dataclass
class AuthContext:
    auth_user_id: uuid.UUID
    email: str | None
    user: User | None


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url)


def decode_token(token: str) -> dict:
    s = get_settings()
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        if s.dev_auth_enabled and unverified.get("iss") == DEV_ISSUER:
            # TODO(team): prototype-only path; disable DEV_AUTH_ENABLED before any pilot.
            return jwt.decode(token, s.dev_jwt_secret, algorithms=["HS256"], audience="authenticated")
        if s.supabase_jwks_url:
            key = _jwks_client(s.supabase_jwks_url).get_signing_key_from_jwt(token).key
            return jwt.decode(token, key, algorithms=["RS256", "ES256"], audience="authenticated")
        if s.supabase_jwt_secret:
            return jwt.decode(token, s.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated")
    except jwt.PyJWTError as exc:
        raise Unauthorized("Your session has expired. Please log in again.") from exc
    raise Unauthorized("Authentication is not configured on the server.")


def mint_dev_token(user_id: uuid.UUID, email: str, ttl_hours: int = 12) -> str:
    from datetime import timedelta

    from app.utils.time import now_utc

    now = now_utc()
    payload = {"sub": str(user_id), "email": email, "aud": "authenticated", "iss": DEV_ISSUER,
               "iat": int(now.timestamp()), "exp": int((now + timedelta(hours=ttl_hours)).timestamp())}
    return jwt.encode(payload, get_settings().dev_jwt_secret, algorithm="HS256")


def get_auth(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> AuthContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise Unauthorized("Please log in to continue.")
    claims = decode_token(authorization.split(" ", 1)[1].strip())
    try:
        sub = uuid.UUID(claims["sub"])
    except (KeyError, ValueError) as exc:
        raise Unauthorized("Invalid session.") from exc
    return AuthContext(auth_user_id=sub, email=claims.get("email"), user=db.get(User, sub))


def get_current_user(ctx: AuthContext = Depends(get_auth)) -> User:
    if ctx.user is None:
        raise Forbidden("Please finish onboarding first.", code="NOT_ONBOARDED")
    return ctx.user


def require_role(*roles: str):
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise Forbidden("You don't have access to this page.")
        return user

    return dep


def require_active(user: User = Depends(get_current_user)) -> User:
    if user.account_status == "suspended":
        raise Forbidden("Your account is suspended. Contact FoodResQ.", code="ACCOUNT_SUSPENDED")
    if user.account_status != "active":
        raise Forbidden("Your account is waiting for verification.", code="ACCOUNT_NOT_ACTIVE")
    return user


def require_active_role(*roles: str):
    def dep(user: User = Depends(require_active)) -> User:
        if user.role not in roles:
            raise Forbidden("You don't have access to this page.")
        return user

    return dep
