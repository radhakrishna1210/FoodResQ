"""Realtime push to the frontend — Supabase Realtime Broadcast (ARCHITECTURE §8.2).

We don't use Supabase Auth (README D6), so the browser's Supabase client holds no session and
connects as the `anon` role. The RLS-gated `postgres_changes` feature would silently deliver nothing
to a connection like that. Broadcast sidesteps this entirely: the backend (service role key,
server-only) pings the user's own channel whenever something notification-worthy happens; the
frontend never trusts the payload, it only invalidates its caches and refetches from the API — so a
missed or duplicate ping is harmless, and the existing 15 s polling remains the fallback if the
channel drops.

Channel names are per-user UUIDs (unguessable), and the payload carries nothing sensitive — the only
thing "leaked" to anyone who somehow guessed a channel name would be the fact that *something*
changed, never what.

IMPORTANT: this fires in a background thread, never inline. `ping_user()` is called from
`notify()`, which runs throughout the matching engine *while a `SELECT ... FOR UPDATE` row lock and
open transaction are held* (ARCHITECTURE §7.1), and from the scheduler's `tick()`. Blocking that
thread on a network round-trip to Supabase — even for ~1-2 s — holds the DB session idle-in-
transaction for the duration, which was observed to trip Supabase's connection-killing protections
and cascade into unrelated "server closed the connection unexpectedly" errors on other requests.
Firing the HTTP call on a daemon thread decouples realtime push latency from the DB transaction
entirely; a slow or unreachable Supabase Realtime endpoint can now never affect request latency or
hold a lock open.
"""

import logging
import threading
import uuid

import httpx

from app.config import get_settings

log = logging.getLogger("foodresq.realtime")

BROADCAST_TIMEOUT_SECONDS = 2.0


def _send(topic: str, event: str) -> None:
    s = get_settings()
    try:
        httpx.post(
            f"{s.supabase_url}/realtime/v1/api/broadcast",
            json={"messages": [{"topic": topic, "event": event, "payload": {}}]},
            headers={"apikey": s.supabase_service_role_key,
                     "Authorization": f"Bearer {s.supabase_service_role_key}"},
            timeout=BROADCAST_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError:
        log.warning("realtime broadcast failed (non-fatal)", exc_info=True)


def _broadcast(topic: str, event: str) -> None:
    s = get_settings()
    if not (s.supabase_url and s.supabase_service_role_key):
        return
    threading.Thread(target=_send, args=(topic, event), daemon=True).start()


def ping_user(user_id: uuid.UUID) -> None:
    """Call after any state change a user should see live — notifications, their donations/offers/
    allocations. Hooked once into services.notifications.notify(), which already covers every
    documented event type (ARCHITECTURE §8.1)."""
    _broadcast(f"user:{user_id}", "change")
