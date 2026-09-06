"""The purchase and sales chains (docs/03_DATA_MODEL.md §4).

Two parallel chains feeding one ledger. `number` is ours, generated and gapless;
`reference` is theirs — free text like the customer's own PO number. Every line
carries `analytic_account_id` (nullable) and a snapshotted `account_id` + `tax_pct`,
captured at creation and never re-read from the product afterward (§6).

Posting these into the ledger is `services/posting.py`'s job, not this file's.
"""

import enum

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.masters import Contact, Product


def _line_checks(table: str) -> tuple[CheckConstraint, ...]:
    """A fresh set of CheckConstraint objects per call.

    A single Constraint instance can only ever belong to one Table — reusing the
    same objects across the four line tables below raises at class-definition
    time, since SQLAlchemy binds each constraint to whichever table claims it
    first. Every line table calls this itself instead of sharing a module-level
    tuple.
    """
    return (
        CheckConstraint("quantity > 0", name=f"ck_{table}_quantity_positive"),
        CheckConstraint("unit_price >= 0", name=f"ck_{table}_unit_price_nonneg"),
        CheckConstraint("tax_pct >= 0 AND tax_pct <= 100", name=f"ck_{table}_tax_pct_range"),
    )


class PurchaseOrderStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    BILLED = "BILLED"
    CANCELLED = "CANCELLED"


class VendorBillStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    POSTED = "POSTED"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class SalesOrderStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    INVOICED = "INVOICED"
    CANCELLED = "CANCELLED"


class CustomerInvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    POSTED = "POSTED"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class PurchaseOrder(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        # The dominant list query is "documents in this status, newest first" —
        # a composite index serves that directly instead of relying on the
        # planner to intersect two single-column indexes.
        Index("ix_purchase_orders_status_date", "status", "order_date"),
    )

    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120))
    vendor_id: Mapped[str] = mapped_column(
        ForeignKey("contacts.id"), nullable=False, index=True
    )
    order_date: Mapped[object] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        SAEnum(PurchaseOrderStatus, native_enum=False),
        default=PurchaseOrderStatus.DRAFT,
        nullable=False,
        index=True,
    )
    untaxed_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    vendor: Mapped[Contact] = relationship(lazy="joined")
    lines: Mapped[list["PurchaseOrderLine"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<PurchaseOrder {self.number}>"


class PurchaseOrderLine(UUIDMixin, Base):
    __tablename__ = "purchase_order_lines"
    __table_args__ = _line_checks("purchase_order_lines")

    order_id: Mapped[str] = mapped_column(
        ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    analytic_account_id: Mapped[str | None] = mapped_column(
        ForeignKey("analytic_accounts.id"), index=True
    )
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)

    product: Mapped[Product] = relationship(lazy="joined")
    order: Mapped[PurchaseOrder] = relationship(back_populates="lines")


class VendorBill(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "vendor_bills"
    __table_args__ = (Index("ix_vendor_bills_status_date", "status", "bill_date"),)

    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120))
    po_id: Mapped[str | None] = mapped_column(ForeignKey("purchase_orders.id"), index=True)
    vendor_id: Mapped[str] = mapped_column(
        ForeignKey("contacts.id"), nullable=False, index=True
    )
    bill_date: Mapped[object] = mapped_column(Date, nullable=False, index=True)
    due_date: Mapped[object | None] = mapped_column(Date, index=True)
    status: Mapped[VendorBillStatus] = mapped_column(
        SAEnum(VendorBillStatus, native_enum=False),
        default=VendorBillStatus.DRAFT,
        nullable=False,
        index=True,
    )
    untaxed_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    journal_entry_id: Mapped[str | None] = mapped_column(ForeignKey("journal_entries.id"))

    # Mail is best-effort and never blocks a posting (docs/06_BACKEND.md §7). A
    # failure records itself here instead of raising, so the UI can report "sent"
    # or "not sent" honestly — the document is already posted by then.
    last_sent_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    last_send_error: Mapped[str | None] = mapped_column(String(200))

    vendor: Mapped[Contact] = relationship(lazy="joined")
    lines: Mapped[list["VendorBillLine"]] = relationship(
        back_populates="bill", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<VendorBill {self.number}>"


class VendorBillLine(UUIDMixin, Base):
    __tablename__ = "vendor_bill_lines"
    __table_args__ = _line_checks("vendor_bill_lines")

    bill_id: Mapped[str] = mapped_column(
        ForeignKey("vendor_bills.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    analytic_account_id: Mapped[str | None] = mapped_column(
        ForeignKey("analytic_accounts.id"), index=True
    )
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)

    product: Mapped[Product] = relationship(lazy="joined")
    bill: Mapped[VendorBill] = relationship(back_populates="lines")


class SalesOrder(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "sales_orders"
    __table_args__ = (Index("ix_sales_orders_status_date", "status", "order_date"),)

    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120))
    customer_id: Mapped[str] = mapped_column(
        ForeignKey("contacts.id"), nullable=False, index=True
    )
    order_date: Mapped[object] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[SalesOrderStatus] = mapped_column(
        SAEnum(SalesOrderStatus, native_enum=False),
        default=SalesOrderStatus.DRAFT,
        nullable=False,
        index=True,
    )
    untaxed_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    customer: Mapped[Contact] = relationship(lazy="joined")
    lines: Mapped[list["SalesOrderLine"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<SalesOrder {self.number}>"


class SalesOrderLine(UUIDMixin, Base):
    __tablename__ = "sales_order_lines"
    __table_args__ = _line_checks("sales_order_lines")

    order_id: Mapped[str] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    analytic_account_id: Mapped[str | None] = mapped_column(
        ForeignKey("analytic_accounts.id"), index=True
    )
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)

    product: Mapped[Product] = relationship(lazy="joined")
    order: Mapped[SalesOrder] = relationship(back_populates="lines")


class CustomerInvoice(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "customer_invoices"
    __table_args__ = (Index("ix_customer_invoices_status_date", "status", "invoice_date"),)

    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120))
    so_id: Mapped[str | None] = mapped_column(ForeignKey("sales_orders.id"), index=True)
    customer_id: Mapped[str] = mapped_column(
        ForeignKey("contacts.id"), nullable=False, index=True
    )
    invoice_date: Mapped[object] = mapped_column(Date, nullable=False, index=True)
    due_date: Mapped[object | None] = mapped_column(Date, index=True)
    status: Mapped[CustomerInvoiceStatus] = mapped_column(
        SAEnum(CustomerInvoiceStatus, native_enum=False),
        default=CustomerInvoiceStatus.DRAFT,
        nullable=False,
        index=True,
    )
    untaxed_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    journal_entry_id: Mapped[str | None] = mapped_column(ForeignKey("journal_entries.id"))

    # Mail is best-effort and never blocks a posting (docs/06_BACKEND.md §7). A
    # failure records itself here instead of raising, so the UI can report "sent"
    # or "not sent" honestly — the document is already posted by then.
    last_sent_at: Mapped[object | None] = mapped_column(DateTime(timezone=True))
    last_send_error: Mapped[str | None] = mapped_column(String(200))

    customer: Mapped[Contact] = relationship(lazy="joined")
    lines: Mapped[list["CustomerInvoiceLine"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<CustomerInvoice {self.number}>"


class CustomerInvoiceLine(UUIDMixin, Base):
    __tablename__ = "customer_invoice_lines"
    __table_args__ = _line_checks("customer_invoice_lines")

    invoice_id: Mapped[str] = mapped_column(
        ForeignKey("customer_invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    analytic_account_id: Mapped[str | None] = mapped_column(
        ForeignKey("analytic_accounts.id"), index=True
    )
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)

    product: Mapped[Product] = relationship(lazy="joined")
    invoice: Mapped[CustomerInvoice] = relationship(back_populates="lines")
