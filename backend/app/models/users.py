import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import enums as e
from app.models.base import Base, ts_now, ts_null


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)  # = Supabase auth.users.id
    role: Mapped[str] = mapped_column(e.user_role, nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    phone: Mapped[str] = mapped_column(Text, nullable=False)
    account_status: Mapped[str] = mapped_column(e.account_status, nullable=False)
    created_at: Mapped[datetime] = ts_now()
    updated_at: Mapped[datetime] = ts_now()

    donor_profile: Mapped["DonorProfile | None"] = relationship(back_populates="user", uselist=False)
    receiver_profile: Mapped["ReceiverProfile | None"] = relationship(
        back_populates="user", uselist=False, foreign_keys="ReceiverProfile.user_id")


class DonorProfile(Base):
    __tablename__ = "donor_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                                               primary_key=True)
    org_name: Mapped[str] = mapped_column(Text, nullable=False)
    donor_type: Mapped[str] = mapped_column(e.donor_type, nullable=False)
    fssai_license_no: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    quality_score: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False, default=Decimal("0.700"))
    created_at: Mapped[datetime] = ts_now()

    user: Mapped[User] = relationship(back_populates="donor_profile")


class ReceiverProfile(Base):
    __tablename__ = "receiver_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                                               primary_key=True)
    org_name: Mapped[str] = mapped_column(Text, nullable=False)
    receiver_type: Mapped[str] = mapped_column(e.receiver_type, nullable=False)
    fssai_registration_no: Mapped[str] = mapped_column(Text, nullable=False)
    ngo_darpan_id: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    service_radius_km: Mapped[Decimal] = mapped_column(Numeric(4, 1), nullable=False, default=Decimal("10"))
    max_capacity_servings: Mapped[int] = mapped_column(Integer, nullable=False)
    diet_accepted: Mapped[str] = mapped_column(e.diet_acceptance, nullable=False)
    accepted_categories: Mapped[list[str]] = mapped_column(ARRAY(e.food_category), nullable=False)
    has_vehicle: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    has_storage: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    has_reheating: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    operating_hours: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_available_now: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    meals_needed_today: Mapped[int | None] = mapped_column(Integer)
    meals_needed_set_on: Mapped[date | None] = mapped_column(Date)
    reliability_score: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False, default=Decimal("0.700"))
    verification_doc_path: Mapped[str | None] = mapped_column(Text)
    verified_at: Mapped[datetime | None] = ts_null()
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = ts_now()

    user: Mapped[User] = relationship(back_populates="receiver_profile", foreign_keys=[user_id])
