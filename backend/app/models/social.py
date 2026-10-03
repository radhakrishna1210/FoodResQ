import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, SmallInteger, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import enums as e
from app.models.base import Base, ts_now, ts_null, uuid_pk


def _fk_user(nullable: bool = False) -> Mapped:
    return mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=nullable)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = uuid_pk()
    allocation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("allocations.id", ondelete="CASCADE"), nullable=False)
    sender_id: Mapped[uuid.UUID] = _fk_user()
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = ts_now()


class Feedback(Base):
    __tablename__ = "feedback"
    __table_args__ = (UniqueConstraint("allocation_id", "direction"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    allocation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("allocations.id", ondelete="CASCADE"), nullable=False)
    from_user_id: Mapped[uuid.UUID] = _fk_user()
    to_user_id: Mapped[uuid.UUID] = _fk_user()
    direction: Mapped[str] = mapped_column(e.feedback_direction, nullable=False)
    overall_rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    on_time: Mapped[bool | None] = mapped_column(Boolean)
    professional: Mapped[bool | None] = mapped_column(Boolean)
    proper_containers: Mapped[bool | None] = mapped_column(Boolean)
    quantity_matched: Mapped[bool | None] = mapped_column(Boolean)
    fresh_on_arrival: Mapped[bool | None] = mapped_column(Boolean)
    properly_packed: Mapped[bool | None] = mapped_column(Boolean)
    safety_issue: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    comment: Mapped[str | None] = mapped_column(Text)
    photo_path: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = ts_now()


class SafetyReport(Base):
    __tablename__ = "safety_reports"

    id: Mapped[uuid.UUID] = uuid_pk()
    allocation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("allocations.id"), nullable=False)
    donation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("donations.id"), nullable=False)
    donor_id: Mapped[uuid.UUID] = _fk_user()
    reported_by: Mapped[uuid.UUID] = _fk_user()
    description: Mapped[str] = mapped_column(Text, nullable=False)
    photo_path: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(e.report_status, nullable=False, default="open")
    admin_notes: Mapped[str | None] = mapped_column(Text)
    resolved_by: Mapped[uuid.UUID | None] = _fk_user(nullable=True)
    resolved_at: Mapped[datetime | None] = ts_null()
    created_at: Mapped[datetime] = ts_now()


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[uuid.UUID] = uuid_pk()
    allocation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("allocations.id"), nullable=False)
    raised_by: Mapped[uuid.UUID] = _fk_user()
    reason: Mapped[str] = mapped_column(e.dispute_reason, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(e.dispute_status, nullable=False, default="open")
    resolution: Mapped[str | None] = mapped_column(Text)
    resolved_by: Mapped[uuid.UUID | None] = _fk_user(nullable=True)
    resolved_at: Mapped[datetime | None] = ts_null()
    created_at: Mapped[datetime] = ts_now()
