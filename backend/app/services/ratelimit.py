"""Simple in-memory per-process rate limiter (acceptable for the MVP, ARCHITECTURE §15)."""

import threading
import time
from collections import defaultdict, deque

from app.errors import RateLimited

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()

LIMITS = {
    "auth": (10, 60),               # 10/min/IP
    "donation_create": (10, 3600),  # 10/hour/donor
    "assistant": (20, 3600),        # 20/hour/user
    "messages": (30, 60),           # 30/min/user
}


def check(bucket: str, key: str) -> None:
    limit, window = LIMITS[bucket]
    now = time.monotonic()
    with _lock:
        q = _hits[f"{bucket}:{key}"]
        while q and q[0] <= now - window:
            q.popleft()
        if len(q) >= limit:
            raise RateLimited("Too many requests. Please wait a moment and try again.")
        q.append(now)


def reset() -> None:
    with _lock:
        _hits.clear()
