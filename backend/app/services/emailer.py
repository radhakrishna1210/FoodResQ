"""Email notifications over SMTP — optional, off unless EMAIL_NOTIFICATIONS_ENABLED=true and SMTP is configured.

`notify()` runs inside DB transactions (often under a row lock), so nothing here ever blocks it: emails are
queued on the session and sent on a daemon thread only AFTER the transaction commits (nothing is sent if it
rolls back). Failures are logged and swallowed — an SMTP outage can never break matching or a request.
"""

import logging
import smtplib
import threading
from email.message import EmailMessage
from email.utils import formataddr

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.config import get_settings

log = logging.getLogger("foodresq.email")

# Notification types worth an email (the rest stay in-app only).
EMAIL_TYPES = {
    "OFFER_RECEIVED", "OFFER_ACCEPTED", "PICKUP_REMINDER", "VERIFICATION_RESULT", "NO_MATCH_ALERT",
    "DONATION_APPROVED", "DONATION_REJECTED",
}
# Seeded demo accounts use non-deliverable addresses; never try to mail them.
_SKIP_DOMAINS = ("foodresq.demo", "example.com", "example.org")


def email_enabled() -> bool:
    s = get_settings()
    return bool(s.email_notifications_enabled and s.smtp_host and s.smtp_user and s.smtp_password
                and (s.email_from or s.smtp_user))


def _deliverable(address: str | None) -> bool:
    return bool(address and "@" in address and not address.lower().endswith(_SKIP_DOMAINS))


def queue_email(db: Session, to_address: str | None, subject: str, body: str, link: str | None = None) -> None:
    if not email_enabled() or not _deliverable(to_address):
        return
    s = get_settings()
    text = body
    if link:
        text += f"\n\nOpen in FoodResQ: {s.frontend_base_url.rstrip('/')}{link}"
    text += "\n\n— FoodResQ\nYou receive this because you have a FoodResQ account."
    db.info.setdefault("pending_emails", []).append((to_address, subject, text))


def _send(to_address: str, subject: str, text: str) -> None:
    s = get_settings()
    sender = s.email_from or s.smtp_user
    msg = EmailMessage()
    msg["From"] = formataddr((s.email_from_name, sender))
    msg["To"] = to_address
    msg["Subject"] = subject
    msg.set_content(text)
    try:
        if s.smtp_secure:
            with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=15) as smtp:
                smtp.login(s.smtp_user, s.smtp_password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
                smtp.starttls()
                smtp.login(s.smtp_user, s.smtp_password)
                smtp.send_message(msg)
    except Exception:  # never let email trouble surface to callers
        log.exception("email to %s failed", to_address)


def _send_all(items: list[tuple[str, str, str]]) -> None:
    for to_address, subject, text in items:
        _send(to_address, subject, text)


@event.listens_for(Session, "after_commit")
def _flush_after_commit(session: Session) -> None:
    items = session.info.pop("pending_emails", None)
    if items:
        threading.Thread(target=_send_all, args=(items,), daemon=True).start()


@event.listens_for(Session, "after_rollback")
def _drop_on_rollback(session: Session) -> None:
    session.info.pop("pending_emails", None)
