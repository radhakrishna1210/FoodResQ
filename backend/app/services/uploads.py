"""Signed upload URLs — ARCHITECTURE §4.5. Uses the Supabase service role on the server only."""

import uuid
from functools import lru_cache

from app.config import get_settings
from app.errors import AppError, Forbidden, ValidationFailed
from app.models import User

BUCKETS = {
    "donation-photos": {"roles": {"donor"}, "types": {"image/jpeg", "image/png", "image/webp"}},
    "verification-docs": {"roles": {"receiver"}, "types": {"image/jpeg", "image/png", "image/webp",
                                                           "application/pdf"}},
    "feedback-photos": {"roles": {"donor", "receiver"}, "types": {"image/jpeg", "image/png", "image/webp"}},
}
EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf"}
MAX_BYTES = 5 * 1024 * 1024
SIGNED_READ_SECONDS = 3600


@lru_cache
def _client():
    s = get_settings()
    if not (s.supabase_url and s.supabase_service_role_key):
        return None
    from supabase import create_client

    return create_client(s.supabase_url, s.supabase_service_role_key)


def sign_upload(user: User, bucket: str, content_type: str, scope_id: uuid.UUID | None = None) -> dict:
    spec = BUCKETS.get(bucket)
    if spec is None:
        raise ValidationFailed("Unknown bucket.", details={"fields": {"bucket": "Invalid."}})
    if user.role not in spec["roles"]:
        raise Forbidden("You can't upload to this bucket.")
    if content_type not in spec["types"]:
        raise ValidationFailed("This file type isn't allowed.", details={"fields": {"content_type": "Invalid."}})
    owner = scope_id if bucket == "feedback-photos" and scope_id else user.id
    path = f"{owner}/{uuid.uuid4()}.{EXT[content_type]}"
    client = _client()
    if client is None:
        # TODO(team): Supabase credentials pending — uploads are unavailable until configured.
        raise AppError("File uploads aren't configured yet.", code="UPLOADS_NOT_CONFIGURED", status_code=503)
    res = client.storage.from_(bucket).create_signed_upload_url(path)
    return {"signed_url": res.get("signed_url") or res.get("signedUrl"), "token": res.get("token"), "path": path,
            "max_bytes": MAX_BYTES}


def signed_read_url(bucket: str, path: str | None) -> str | None:
    if not path:
        return None
    client = _client()
    if client is None:
        return None
    try:
        res = client.storage.from_(bucket).create_signed_url(path, SIGNED_READ_SECONDS)
        return res.get("signedURL") or res.get("signedUrl") or res.get("signed_url")
    except Exception:
        return None
