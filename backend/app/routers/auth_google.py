"""Google Sign-In — direct OAuth 2.0 authorization-code flow against our own backend (no Supabase).

Accounts are resolved by email: the internal user id is derived the same deterministic way as
scripts/seed.py and the prototype dev-login (`uuid5(NAMESPACE_URL, "foodresq-demo:{email}")`), so a
Google login and a dev/email login for the same address always land on the same account and role.
"""

import time
import uuid
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import mint_app_token
from app.config import get_settings
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/auth/google", tags=["auth"])

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")
STATE_TTL_SECONDS = 600


def _make_state() -> str:
    payload = {"nonce": uuid.uuid4().hex, "exp": int(time.time()) + STATE_TTL_SECONDS}
    return jwt.encode(payload, get_settings().app_jwt_secret, algorithm="HS256")


def _state_is_valid(state: str | None) -> bool:
    if not state:
        return False
    try:
        jwt.decode(state, get_settings().app_jwt_secret, algorithms=["HS256"])
        return True
    except jwt.PyJWTError:
        return False


@router.get("/login", include_in_schema=False)
def google_login():
    s = get_settings()
    params = {
        "client_id": s.google_client_id,
        "redirect_uri": s.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": _make_state(),
    }
    return RedirectResponse(f"{AUTHORIZE_URL}?{urlencode(params)}")


@router.get("/callback", include_in_schema=False)
def google_callback(code: str | None = None, state: str | None = None, error: str | None = None,
                    db: Session = Depends(get_db)):
    s = get_settings()
    frontend = s.frontend_base_url.rstrip("/")

    def fail(reason: str) -> RedirectResponse:
        return RedirectResponse(f"{frontend}/auth/callback?{urlencode({'error': reason})}")

    if error or not code or not _state_is_valid(state):
        return fail("google_denied")

    token_res = httpx.post(TOKEN_URL, data={
        "code": code, "client_id": s.google_client_id, "client_secret": s.google_client_secret,
        "redirect_uri": s.google_redirect_uri, "grant_type": "authorization_code",
    }, timeout=10)
    if token_res.status_code != 200:
        return fail("google_token_exchange_failed")
    id_token = token_res.json().get("id_token")

    try:
        key = jwt.PyJWKClient(JWKS_URL).get_signing_key_from_jwt(id_token).key
        claims = jwt.decode(id_token, key, algorithms=["RS256"], audience=s.google_client_id)
    except jwt.PyJWTError:
        return fail("google_invalid_token")
    if claims.get("iss") not in GOOGLE_ISSUERS or not claims.get("email_verified"):
        return fail("google_invalid_token")

    email = claims["email"].lower()
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    # Unknown email → a fresh, not-yet-onboarded identity (same id scripts/seed.py and /dev/login would
    # use), so a Google login and a dev/email login for the same address resolve to one account.
    user_id = user.id if user else uuid.uuid5(uuid.NAMESPACE_URL, f"foodresq-demo:{email}")
    token = mint_app_token(user_id, email)
    return RedirectResponse(f"{frontend}/auth/callback?{urlencode({'token': token})}")
