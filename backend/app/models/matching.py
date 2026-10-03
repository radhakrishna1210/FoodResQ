import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CHAR, Boolean, ForeignKey, Integer, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import enums as e
from app.models.base import Base, ts_now, ts_null, ts_req, uuid_pk


class MatchRun(Base):
    __tablename__ = "match_runs"

    id: Mapped[uuid.UUID] = uuid_pk()
    donation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("donations.id", ondelete="CASCADE"),
                                                   nullable=False)
    run_at: Mapped[datetime] = ts_now()
    trigger: Mapped[str] = mapped_column(Text, nullable=False)
    search_radius_km: Mapped[Decimal] = mapped_column(Numeric(4, 1), nullable=False)
    remaining_servings: Mapped[int] = mapped_column(Integer, nullable=False)
    weights: Mapped[dict] = mapped_column(JSONB, nullable=False)
    candidates: Mapped[list] = mapped_column(JSONB, nullable=False)


class Offer(Base):
    __tablename__ = "offers"
    __table_args__ = (UniqueConstraint("donation_id", "receiver_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    donation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("donations.id", ondelete="CASCADE"),
                                                   nullable=False)
    receiver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    match_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("match_runs.id"), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    match_score: Mapped[int] = mapped_column(Integer, nullable=False)
    factor_scores: Mapped[dict] = mapped_column(JSONB, nullable=False)
    reasons: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    distance_km: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)
    eta_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    offered_servings: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(e.offer_status, nullable=False, default="PENDING")
    offered_at: Mapped[datetime] = ts_now()
    expires_at: Mapped[datetime] = ts_req()
    responded_at: Mapped[datetime | None] = ts_null()
    decline_reason: Mapped[str | None] = mapped_column(Text)


class Allocation(Base):
    __tablename__ = "allocations"

    id: Mapped[uuid.UUID] = uuid_pk()
    donation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("donations.id", ondelete="CASCADE"),
                                                   nullable=False)
    receiver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    offer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("offers.id"), unique=True)
    servings: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(e.allocation_status, nullable=False, default="ACCEPTED")
    handover_code: Mapped[str] = mapped_column(CHAR(4), nullable=False)
    handover_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    accepted_at: Mapped[datetime] = ts_now()
    eta_at: Mapped[datetime] = ts_req()
    collected_at: Mapped[datetime | None] = ts_null()
    servings_distributed: Mapped[int | None] = mapped_column(Integer)
    distribution_area: Mapped[str | None] = mapped_column(Text)
    distributed_at: Mapped[datetime | None] = ts_null()
    completed_at: Mapped[datetime | None] = ts_null()
    completion_unconfirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cancelled_at: Mapped[datetime | None] = ts_null()
    cancelled_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    cancel_reason: Mapped[str | None] = mapped_column(Text)
