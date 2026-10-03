"""jobs.tick() — ARCHITECTURE §12. Every step is idempotent and uses row locks.

Runs every 60 s via APScheduler (if SCHEDULER_ENABLED) and on POST /api/v1/internal/tick.
"""

import logging
import threading
import uuid
from datetime import datetime, timedelta

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.models import Allocation, Donation, Notification, Offer
from app.services import allocations as alloc_svc
from app.services import notifications as notif
from app.services import offers as offer_svc
from app.services.app_config import get_config
from app.services.donations import expire_or_close
from app.services.matching.engine import lock_donation, maybe_no_match_alert, run_matching
from app.utils.time import now_utc

log = logging.getLogger("foodresq.jobs")
_tick_lock = threading.Lock()


def _offer_timeouts(db: Session, now: datetime) -> int:
    ids = db.execute(select(Offer.id).where(Offer.status == "PENDING", Offer.expires_at < now)).scalars().all()
    n = 0
    for oid in ids:
        n += offer_svc.time_out(db, db.get(Offer, oid), now)
    return n


def _pickup_reminders(db: Session, now: datetime) -> int:
    rows = db.execute(select(Allocation, Donation).join(Donation, Donation.id == Allocation.donation_id).where(
        Allocation.status == "ACCEPTED", Donation.effective_deadline - now <= timedelta(minutes=30),
        Donation.effective_deadline > now)).all()
    n = 0
    for a, d in rows:
        link = f"/receiver/pickups/{a.id}"
        already = db.execute(select(exists().where(Notification.user_id == a.receiver_id,
                                                   Notification.type == "PICKUP_REMINDER",
                                                   Notification.link == link))).scalar()
        if not already:
            notif.notify(db, a.receiver_id, "PICKUP_REMINDER", "Pickup soon",
                         f"Please collect \"{d.title}\" in the next 30 minutes.", link)
            n += 1
    return n


def _expiry(db: Session, now: datetime) -> int:
    ids = db.execute(select(Donation.id).where(Donation.status.in_(["POSTED", "MATCHED", "FLAGGED"]),
                                               Donation.effective_deadline < now)).scalars().all()
    for did in ids:
        d = lock_donation(db, did)
        expire_or_close(db, d, now)
    return len(ids)


def _no_shows(db: Session, now: datetime) -> int:
    grace = timedelta(minutes=get_config(db)["no_show_grace_minutes"])
    rows = db.execute(select(Allocation).join(Donation, Donation.id == Allocation.donation_id).where(
        Allocation.status == "ACCEPTED", Donation.effective_deadline + grace < now)).scalars().all()
    return sum(alloc_svc.mark_no_show(db, a, now) for a in rows)


def _rematch(db: Session, now: datetime) -> int:
    pending = select(Offer.id).where(Offer.donation_id == Donation.id, Offer.status == "PENDING").exists()
    ids = db.execute(select(Donation.id).where(Donation.status == "POSTED", Donation.remaining_servings > 0,
                                               Donation.effective_deadline > now, ~pending)).scalars().all()
    for did in ids:
        run_matching(db, did, "scheduler", now=now)
    return len(ids)


def _no_match_alerts(db: Session, now: datetime) -> int:
    ids = db.execute(select(Donation.id).where(
        Donation.status.in_(["POSTED", "MATCHED"]), Donation.remaining_servings > 0,
        Donation.no_match_alerted_at.is_(None), Donation.effective_deadline > now,
        Donation.effective_deadline - now < timedelta(minutes=30))).scalars().all()
    for did in ids:
        maybe_no_match_alert(db, lock_donation(db, did), zero_at_max=False, now=now)
    return len(ids)


def _auto_complete(db: Session, now: datetime) -> int:
    hours = get_config(db)["auto_complete_hours"]
    rows = db.execute(select(Allocation).where(Allocation.status == "COLLECTED",
                                               Allocation.collected_at < now - timedelta(hours=hours))).scalars().all()
    return sum(alloc_svc.auto_complete(db, a, now) for a in rows)


STEPS = [("offer_timeouts", _offer_timeouts), ("pickup_reminders", _pickup_reminders), ("expiry", _expiry),
         ("no_shows", _no_shows), ("rematch", _rematch), ("no_match_alerts", _no_match_alerts),
         ("auto_complete", _auto_complete)]
# Step 8 (daily reset) needs no work: meals_needed_today is ignored when meals_needed_set_on != today.


def tick(db: Session, now: datetime | None = None) -> dict[str, int]:
    now = now or now_utc()
    result: dict[str, int] = {}
    with _tick_lock:
        for name, step in STEPS:
            try:
                result[name] = step(db, now)
                db.commit()
            except Exception:  # keep other steps running; log and continue
                db.rollback()
                log.exception("tick step %s failed", name)
                result[name] = -1
    return result


def lazy_check_donation(db: Session, donation_id: uuid.UUID, now: datetime | None = None) -> None:
    """Apply steps 1, 3 and 4 to a single donation before reading it (§12 lazy checks)."""
    now = now or now_utc()
    for oid in db.execute(select(Offer.id).where(Offer.donation_id == donation_id, Offer.status == "PENDING",
                                                 Offer.expires_at < now)).scalars().all():
        offer_svc.time_out(db, db.get(Offer, oid), now)
    d = db.get(Donation, donation_id)
    if d and d.status in ("POSTED", "MATCHED", "FLAGGED") and d.effective_deadline < now:
        expire_or_close(db, lock_donation(db, donation_id), now)
    grace = timedelta(minutes=get_config(db)["no_show_grace_minutes"])
    if d and d.effective_deadline + grace < now:
        for a in db.execute(select(Allocation).where(Allocation.donation_id == donation_id,
                                                     Allocation.status == "ACCEPTED")).scalars().all():
            alloc_svc.mark_no_show(db, a, now)
    db.flush()


def count_pending(db: Session) -> int:
    return db.execute(select(func.count()).select_from(Offer).where(Offer.status == "PENDING")).scalar_one()
