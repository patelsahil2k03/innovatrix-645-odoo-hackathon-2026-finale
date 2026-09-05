"""Payments (docs/03_DATA_MODEL.md §4). One payment settles one document — raised
from that document's own Pay button, matching the mockup rather than a general
many-to-many allocation model. Partial payment is simply an amount less than the
balance, not a split across documents.
"""

import enum

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDMixin


class PaymentDirection(str, enum.Enum):
    RECEIVE = "RECEIVE"
    SEND = "SEND"


class Payment(UUIDMixin, Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payments_amount_positive"),
        CheckConstraint(
            "(invoice_id IS NULL) <> (bill_id IS NULL)",
            name="ck_payments_exactly_one_target",
        ),
    )

    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    contact_id: Mapped[str] = mapped_column(
        ForeignKey("contacts.id"), nullable=False, index=True
    )
    direction: Mapped[PaymentDirection] = mapped_column(
        SAEnum(PaymentDirection, native_enum=False), nullable=False, index=True
    )
    journal_id: Mapped[str] = mapped_column(ForeignKey("journals.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_date: Mapped[object] = mapped_column(Date, nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(String(200))

    invoice_id: Mapped[str | None] = mapped_column(
        ForeignKey("customer_invoices.id"), index=True
    )
    bill_id: Mapped[str | None] = mapped_column(ForeignKey("vendor_bills.id"), index=True)
    journal_entry_id: Mapped[str | None] = mapped_column(ForeignKey("journal_entries.id"))

    # The double-click guard — a repeat request with the same key returns the
    # original payment instead of creating a second one (docs/06_BACKEND.md §5).
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)

    def __repr__(self) -> str:
        return f"<Payment {self.number} {self.direction} {self.amount}>"
