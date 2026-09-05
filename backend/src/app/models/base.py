"""Declarative base and the mixins every table should use."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def new_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    """Always UTC, never naive local time.

    Mixing `date.today()` (local) with `datetime.now(UTC)` is what made three tests
    fail on every IST machine in the previous project. Pick UTC and stay there.
    """
    return datetime.now(UTC)


class UUIDMixin:
    """String UUID primary key — identical behaviour on SQLite and PostgreSQL."""

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )
