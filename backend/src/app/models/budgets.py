"""Budgets, with a revision chain instead of an editable planned amount
(docs/03_DATA_MODEL.md §2). A CONFIRMED budget is never edited — revising it
creates a linked successor and moves the original to REVISED.

Only `committed_amount` is stored on a line. Achieved, achieved %, and
amount-to-achieve are computed on read by summing document lines carrying the
line's analytic tag within the budget period — that computation is
`services/budgets.py`'s job, not this file's.
"""

import enum

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class BudgetState(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    REVISED = "REVISED"
    CANCELLED = "CANCELLED"


class Budget(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "budgets"
    __table_args__ = (
        CheckConstraint("period_end > period_start", name="ck_budgets_period_valid"),
    )

    # On revision, the successor is named "<original name> Revised".
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    period_start: Mapped[object] = mapped_column(Date, nullable=False)
    period_end: Mapped[object] = mapped_column(Date, nullable=False)
    # The mockup selects "Responsible" from Contacts, not from internal users.
    responsible_id: Mapped[str | None] = mapped_column(ForeignKey("contacts.id"))
    state: Mapped[BudgetState] = mapped_column(
        SAEnum(BudgetState, native_enum=False),
        default=BudgetState.DRAFT,
        nullable=False,
        index=True,
    )

    # Revision chain: set on the successor / the original respectively.
    revision_of_id: Mapped[str | None] = mapped_column(ForeignKey("budgets.id"))
    revised_with_id: Mapped[str | None] = mapped_column(ForeignKey("budgets.id"))

    lines: Mapped[list["BudgetLine"]] = relationship(
        back_populates="budget", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Budget {self.name} {self.state}>"


class BudgetLine(UUIDMixin, Base):
    __tablename__ = "budget_lines"
    __table_args__ = (
        CheckConstraint("committed_amount >= 0", name="ck_budget_lines_committed_nonneg"),
        UniqueConstraint("budget_id", "analytic_account_id", name="uq_budget_lines_analytic"),
    )

    budget_id: Mapped[str] = mapped_column(
        ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    analytic_account_id: Mapped[str] = mapped_column(
        ForeignKey("analytic_accounts.id"), nullable=False, index=True
    )
    committed_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    budget: Mapped[Budget] = relationship(back_populates="lines")
