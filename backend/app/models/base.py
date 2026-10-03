import uuid
from datetime import datetime

from sqlalchemy import DateTime, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"),
                         default=uuid.uuid4)


def ts_now() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


def ts_null() -> Mapped[datetime | None]:
    return mapped_column(DateTime(timezone=True), nullable=True)


def ts_req() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False)
