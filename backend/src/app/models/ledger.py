"""The ledger. Two tables carry the whole differentiator (docs/03_DATA_MODEL.md §3):
every document posts one balanced entry here, and every report aggregates these
lines — never the documents beside them.

This file defines the *schema* only. The one function permitted to write
`journal_lines` (`post_entry`, plus `reverse_entry` for corrections) belongs in
`services/posting.py`, not here — see docs/06_BACKEND.md §2.
"""

import enum

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin


class NumberSequence(Base):
    """Backs every gapless number in the system — journal entries and all four
    document types (docs/03_DATA_MODEL.md §5). One row per (kind, year) or per
    kind alone for the two that don't carry a year.

    `key` examples: "je:2026", "inv:2026", "bill:2026", "so", "po".

    The service layer locks the row (`SELECT ... FOR UPDATE`), reads `next_value`,
    increments it, and formats the number — never `MAX(number) + 1`, which races
    two concurrent confirms into the same value. This table has no logic of its
    own; it only exists to be lockable.
    """

    __tablename__ = "number_sequences"

    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    next_value: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class EntryState(str, enum.Enum):
    DRAFT = "DRAFT"
    POSTED = "POSTED"
    REVERSED = "REVERSED"


class JournalEntry(UUIDMixin, Base):
    """A journal entry is its own object in the ledger, with its own numbering
    sequence independent of the document that caused it (§3) — a real general
    ledger lets you walk entries in the order they were posted, and a reversal
    has no document of its own to be numbered after."""

    __tablename__ = "journal_entries"

    entry_number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    journal_id: Mapped[str] = mapped_column(
        ForeignKey("journals.id"), nullable=False, index=True
    )
    entry_date: Mapped[object] = mapped_column(Date, nullable=False, index=True)
    reference: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[EntryState] = mapped_column(
        SAEnum(EntryState, native_enum=False),
        default=EntryState.DRAFT,
        nullable=False,
        index=True,
    )

    # customer_invoice | vendor_bill | payment | manual
    source_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    source_id: Mapped[str | None] = mapped_column(String(36), index=True)

    reversal_of_id: Mapped[str | None] = mapped_column(ForeignKey("journal_entries.id"))
    posted_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    posted_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))

    __table_args__ = (
        # One live entry per document — the database-level guard against double
        # posting. A partial unique index: a REVERSED entry doesn't block a new
        # one for the same source, since the reversal supersedes it.
        #
        # The literal here MUST match what SQLAlchemy actually stores for a
        # `str, enum.Enum` column with native_enum=False: the member's `.name`,
        # not `.value` — confirmed against a real Postgres insert, not assumed.
        # Every enum in this codebase sets value == name (all caps) specifically
        # so this can never again drift silently out of sync with storage.
        Index(
            "uq_journal_entries_source_live",
            "source_type",
            "source_id",
            unique=True,
            sqlite_where=text("state != 'REVERSED'"),
            postgresql_where=text("state != 'REVERSED'"),
        ),
        # Every report is `WHERE state = 'POSTED' AND entry_date <= :as_of`,
        # then joined into journal_lines and grouped by account — this composite
        # index is what makes that filter step index-only instead of a scan.
        Index("ix_journal_entries_state_date", "state", "entry_date"),
    )

    def __repr__(self) -> str:
        return f"<JournalEntry {self.entry_number} {self.state}>"


class JournalLine(UUIDMixin, Base):
    __tablename__ = "journal_lines"
    __table_args__ = (
        CheckConstraint("debit >= 0 AND credit >= 0", name="ck_journal_lines_nonneg"),
        CheckConstraint("NOT (debit > 0 AND credit > 0)", name="ck_journal_lines_one_sided"),
        CheckConstraint("debit > 0 OR credit > 0", name="ck_journal_lines_not_empty"),
    )

    entry_id: Mapped[str] = mapped_column(
        ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[str] = mapped_column(
        ForeignKey("accounts.id"), nullable=False, index=True
    )
    # Nullable and unused by any computation today — analytic reporting for
    # budgets reads document lines, not journal lines (§2). Kept for future use.
    analytic_account_id: Mapped[str | None] = mapped_column(
        ForeignKey("analytic_accounts.id"), index=True
    )
    partner_id: Mapped[str | None] = mapped_column(ForeignKey("contacts.id"), index=True)
    label: Mapped[str | None] = mapped_column(String(200))
    debit: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    credit: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<JournalLine {self.account_id} dr={self.debit} cr={self.credit}>"
