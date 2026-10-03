"""Two-way feedback, blind rule, safety reports — ARCHITECTURE §13.3."""

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import Conflict, ValidationFailed
from app.models import Dispute, Feedback, SafetyReport, User
from app.services import notifications as notif
from app.services import trust
from app.services.allocations import ensure_party, get_for_party
from app.services.app_config import get_config
from app.services.audit import write_audit
from app.utils.time import now_utc

DONOR_FIELDS = ("on_time", "professional", "proper_containers")
RECEIVER_FIELDS = ("quantity_matched", "fresh_on_arrival", "properly_packed")


def _window_closed(db: Session, a) -> bool:
    hours = get_config(db)["feedback_window_hours"]
    return a.completed_at is not None and now_utc() > a.completed_at + timedelta(hours=hours)


def submit(db: Session, allocation_id: uuid.UUID, user: User, data: dict[str, Any]) -> Feedback:
    a, d = get_for_party(db, allocation_id, user)
    side = ensure_party(a, d, user)
    if a.status != "COMPLETED":
        raise Conflict("Feedback opens after the rescue is completed.", code="INVALID_TRANSITION")
    if _window_closed(db, a):
        raise Conflict("The 24-hour feedback window has closed.", code="FEEDBACK_CLOSED")
    rating = data.get("overall_rating")
    if not isinstance(rating, int) or not 1 <= rating <= 5:
        raise ValidationFailed("Please choose 1–5 stars.", details={"fields": {"overall_rating": "1–5"}})
    comment = (data.get("comment") or "").strip() or None
    if comment and len(comment) > 500:
        raise ValidationFailed("Comment is too long.", details={"fields": {"comment": "Max 500 characters."}})

    fb = Feedback(allocation_id=a.id, from_user_id=user.id, overall_rating=rating, comment=comment)
    if side == "donor":
        fb.direction, fb.to_user_id = "donor_to_receiver", a.receiver_id
        for f in DONOR_FIELDS:
            setattr(fb, f, data.get(f))
    else:
        fb.direction, fb.to_user_id = "receiver_to_donor", d.donor_id
        for f in RECEIVER_FIELDS:
            setattr(fb, f, data.get(f))
        fb.safety_issue = bool(data.get("safety_issue"))
        fb.photo_path = data.get("photo_path")
        if fb.safety_issue and (not comment or len(comment) < 10):
            raise ValidationFailed("Please describe the safety issue (at least 10 characters).",
                                   details={"fields": {"comment": "At least 10 characters."}})
    db.add(fb)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise Conflict("You've already submitted feedback for this rescue.", code="FEEDBACK_EXISTS") from exc

    if fb.safety_issue:
        report = SafetyReport(allocation_id=a.id, donation_id=d.id, donor_id=d.donor_id, reported_by=user.id,
                              description=comment, photo_path=fb.photo_path)
        db.add(report)
        db.flush()
        write_audit(db, actor_id=user.id, action="safety_report.created", entity_type="safety_report",
                    entity_id=report.id, after={"donation_id": str(d.id)})
        notif.notify_admins(db, "SAFETY_REPORT", "Food-safety issue reported", comment[:140],
                            "/admin/safety")
    if side == "donor":
        trust.recompute_reliability(db, a.receiver_id)
    else:
        trust.recompute_quality(db, d.donor_id)
    return fb


def visible(db: Session, allocation_id: uuid.UUID, user: User) -> dict[str, Any]:
    """Blind rule enforced server-side: see the other side only after submitting or after 24 h."""
    a, d = get_for_party(db, allocation_id, user)
    rows = db.execute(select(Feedback).where(Feedback.allocation_id == a.id)).scalars().all()
    if user.role == "admin":
        return {"mine": None, "theirs": None, "all": rows, "window_closed": _window_closed(db, a)}
    side = ensure_party(a, d, user)
    my_dir = "donor_to_receiver" if side == "donor" else "receiver_to_donor"
    mine = next((f for f in rows if f.direction == my_dir), None)
    theirs = next((f for f in rows if f.direction != my_dir), None)
    closed = _window_closed(db, a)
    return {"mine": mine, "theirs": theirs if (mine is not None or closed) else None,
            "theirs_submitted": theirs is not None, "window_closed": closed, "all": None}


def open_dispute(db: Session, allocation_id: uuid.UUID, user: User, reason: str, description: str) -> Dispute:
    a, d = get_for_party(db, allocation_id, user)
    ensure_party(a, d, user)
    if reason not in ("no_show", "quantity_mismatch", "quality_issue", "behaviour", "other"):
        raise ValidationFailed("Please pick a reason.", details={"fields": {"reason": "Invalid."}})
    if not 10 <= len((description or "").strip()) <= 1000:
        raise ValidationFailed("Description must be 10–1000 characters.",
                               details={"fields": {"description": "10–1000 characters."}})
    dispute = Dispute(allocation_id=a.id, raised_by=user.id, reason=reason, description=description.strip())
    db.add(dispute)
    db.flush()
    write_audit(db, actor_id=user.id, action="dispute.opened", entity_type="dispute", entity_id=dispute.id,
                after={"reason": reason})
    notif.notify_admins(db, "DISPUTE_OPENED", "New dispute", f"{reason}: {description[:120]}", "/admin/disputes")
    return dispute
