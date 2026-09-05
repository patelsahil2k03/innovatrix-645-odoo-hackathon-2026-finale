import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, String, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, GUID, TimestampMixin, UUIDMixin
from .enums import EntryState


class JournalEntry(Base, UUIDMixin, TimestampMixin):
    """The ledger spine. Immutable once POSTED — see docs/03_DATA_MODEL.md §3."""

    __tablename__ = "journal_entries"
    __table_args__ = (
        Index(
            "uq_journal_entry_source_live",
            "source_type",
            "source_id",
            unique=True,
            sqlite_where=text("state != 'REVERSED'"),
            postgresql_where=text("state != 'REVERSED'"),
        ),
    )

    entry_number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    journal_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("journals.id"), index=True)
    entry_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[EntryState] = mapped_column(
        SAEnum(EntryState, native_enum=False), index=True, default=EntryState.DRAFT
    )
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)
    source_id: Mapped[uuid.UUID | None] = mapped_column(GUID())
    reversal_of_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("journal_entries.id"))
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    posted_by_id: Mapped[uuid.UUID | None] = mapped_column(GUID())

    lines: Mapped[list["JournalLine"]] = relationship(
        back_populates="entry", cascade="all, delete-orphan"
    )


class JournalLine(Base, UUIDMixin):
    """No TimestampMixin — a posted line is never edited, only reversed."""

    __tablename__ = "journal_lines"
    __table_args__ = (
        CheckConstraint("debit >= 0 AND credit >= 0", name="ck_line_nonneg"),
        CheckConstraint("NOT (debit > 0 AND credit > 0)", name="ck_line_one_sided"),
        CheckConstraint("debit > 0 OR credit > 0", name="ck_line_not_empty"),
    )

    entry_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("journal_entries.id", ondelete="CASCADE"), index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("accounts.id"), index=True)
    analytic_account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("analytic_accounts.id"), index=True
    )
    partner_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("contacts.id"))
    label: Mapped[str | None] = mapped_column(String(200))
    debit: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    credit: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    entry: Mapped[JournalEntry] = relationship(back_populates="lines")
