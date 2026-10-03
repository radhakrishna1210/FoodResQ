import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import enums as e
from app.models.base import Base, ts_now, ts_null, ts_req, uuid_pk


class Donation(Base):
    __tablename__ = "donations"

    id: Mapped[uuid.UUID] = uuid_pk()
    donor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    food_category: Mapped[str] = mapped_column(e.food_category, nullable=False)
    diet_type: Mapped[str] = mapped_column(e.diet_type, nullable=False)
    quantity_servings: Mapped[int] = mapped_column(Integer, nullable=False)
    remaining_servings: Mapped[int] = mapped_column(Integer, nullable=False)
    expired_servings: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quantity_kg: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))
    allergens: Mapped[str | None] = mapped_column(Text)
    storage_condition: Mapped[str] = mapped_column(e.storage_condition, nullable=False)
    ambient_above_32c: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    prepared_at: Mapped[datetime] = ts_req()
    packaged_expiry_date: Mapped[date | None] = mapped_column(Date)
    donor_pickup_by: Mapped[datetime] = ts_req()
    safe_pickup_deadline: Mapped[datetime] = ts_req()
    effective_deadline: Mapped[datetime] = ts_req()
    pickup_address: Mapped[str] = mapped_column(Text, nullable=False)
    pickup_lat: Mapped[float] = mapped_column(Float, nullable=False)
    pickup_lng: Mapped[float] = mapped_column(Float, nullable=False)
    pickup_instructions: Mapped[str | None] = mapped_column(Text)
    contact_phone: Mapped[str] = mapped_column(Text, nullable=False)
    batch_no: Mapped[str | None] = mapped_column(Text)
    temperature_c: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    checklist: Mapped[dict] = mapped_column(JSONB, nullable=False)
    declaration_accepted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    declaration_at: Mapped[datetime] = ts_req()
    photo_paths: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    status: Mapped[str] = mapped_column(e.donation_status, nullable=False)
    priority_score: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    priority_level: Mapped[str] = mapped_column(e.priority_level, nullable=False)
    search_radius_km: Mapped[Decimal] = mapped_column(Numeric(4, 1), nullable=False, default=Decimal("10"))
    flag_reasons: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    cancel_reason: Mapped[str | None] = mapped_column(Text)
    no_match_alerted_at: Mapped[datetime | None] = ts_null()
    posted_at: Mapped[datetime] = ts_now()
    updated_at: Mapped[datetime] = ts_now()
