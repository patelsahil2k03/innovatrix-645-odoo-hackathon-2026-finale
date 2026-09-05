import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, GUID, TimestampMixin, UUIDMixin
from .enums import DocStatus


def _line_table_args(prefix: str) -> tuple:
    return (
        CheckConstraint("quantity > 0", name=f"ck_{prefix}_qty_positive"),
        CheckConstraint("unit_price >= 0", name=f"ck_{prefix}_unit_price_nonneg"),
    )


class PurchaseOrder(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "purchase_orders"

    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120))
    vendor_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("contacts.id"), index=True)
    order_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[DocStatus] = mapped_column(
        SAEnum(DocStatus, native_enum=False), index=True, default=DocStatus.DRAFT
    )
    untaxed_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    lines: Mapped[list["PurchaseOrderLine"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class PurchaseOrderLine(Base, UUIDMixin):
    __tablename__ = "purchase_order_lines"
    __table_args__ = _line_table_args("po_line")

    document_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("products.id"))
    analytic_account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("analytic_accounts.id"), index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("accounts.id"))
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0)

    document: Mapped[PurchaseOrder] = relationship(back_populates="lines")


class VendorBill(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "vendor_bills"

    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120))
    po_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("purchase_orders.id"))
    vendor_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("contacts.id"), index=True)
    bill_date: Mapped[date] = mapped_column(Date, index=True)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[DocStatus] = mapped_column(
        SAEnum(DocStatus, native_enum=False), index=True, default=DocStatus.DRAFT
    )
    untaxed_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("journal_entries.id"))

    lines: Mapped[list["VendorBillLine"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class VendorBillLine(Base, UUIDMixin):
    __tablename__ = "vendor_bill_lines"
    __table_args__ = _line_table_args("bill_line")

    document_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("vendor_bills.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("products.id"))
    analytic_account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("analytic_accounts.id"), index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("accounts.id"))
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0)

    document: Mapped[VendorBill] = relationship(back_populates="lines")


class SalesOrder(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "sales_orders"

    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120))
    customer_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("contacts.id"), index=True)
    order_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[DocStatus] = mapped_column(
        SAEnum(DocStatus, native_enum=False), index=True, default=DocStatus.DRAFT
    )
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    lines: Mapped[list["SalesOrderLine"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class SalesOrderLine(Base, UUIDMixin):
    __tablename__ = "sales_order_lines"
    __table_args__ = _line_table_args("so_line")

    document_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("sales_orders.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("products.id"))
    analytic_account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("analytic_accounts.id"), index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("accounts.id"))
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0)

    document: Mapped[SalesOrder] = relationship(back_populates="lines")


class CustomerInvoice(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "customer_invoices"

    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120))
    so_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("sales_orders.id"))
    customer_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("contacts.id"), index=True)
    invoice_date: Mapped[date] = mapped_column(Date, index=True)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[DocStatus] = mapped_column(
        SAEnum(DocStatus, native_enum=False), index=True, default=DocStatus.DRAFT
    )
    untaxed_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    journal_entry_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("journal_entries.id"))

    lines: Mapped[list["CustomerInvoiceLine"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class CustomerInvoiceLine(Base, UUIDMixin):
    __tablename__ = "customer_invoice_lines"
    __table_args__ = _line_table_args("invoice_line")

    document_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("customer_invoices.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("products.id"))
    analytic_account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("analytic_accounts.id"), index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("accounts.id"))
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0)

    document: Mapped[CustomerInvoice] = relationship(back_populates="lines")
