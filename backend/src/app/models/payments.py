import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, GUID, TimestampMixin, UUIDMixin
from .enums import PaymentDirection


class Payment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payment_amount_positive"),
        CheckConstraint(
            "(invoice_id IS NULL) != (bill_id IS NULL)", name="ck_payment_exactly_one_target"
        ),
    )

    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    contact_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("contacts.id"), index=True)
    direction: Mapped[PaymentDirection] = mapped_column(
        SAEnum(PaymentDirection, native_enum=False), nullable=False
    )
    journal_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("journals.id"))
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(200))
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("customer_invoices.id"))
    bill_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("vendor_bills.id"))
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("journal_entries.id"))
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
