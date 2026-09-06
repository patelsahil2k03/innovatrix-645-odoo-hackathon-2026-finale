"""Request and response shapes for the two document chains.

`number` is never accepted from a client — it is allocated server-side from a
locked sequence row (docs/03_DATA_MODEL.md §5). `reference` is the user's own
free text and *is* accepted. The two are different fields for different owners,
which is why neither `Create` model below has a `number`.

Line `account_id` and `tax_pct` are optional on the way in: omitted, they are
snapshotted from the product at creation time. Supplied, they are taken as given
and still never re-read from the product afterwards (§6).
"""

from datetime import date, datetime

from pydantic import AliasPath, BaseModel, Field, computed_field

from app.models.documents import (
    CustomerInvoiceStatus,
    PurchaseOrderStatus,
    SalesOrderStatus,
    VendorBillStatus,
)
from app.schemas.common import Money, ORMModel
from app.services.money import line_amounts


class DocumentLineIn(BaseModel):
    product_id: str
    quantity: Money = Field(gt=0)
    unit_price: Money | None = Field(default=None, ge=0)
    tax_pct: Money | None = Field(default=None, ge=0, le=100)
    account_id: str | None = None
    analytic_account_id: str | None = None


class DocumentLineOut(ORMModel):
    id: str
    product_id: str
    account_id: str
    analytic_account_id: str | None
    quantity: Money
    unit_price: Money
    tax_pct: Money
    product_name: str | None = Field(
        default=None, validation_alias=AliasPath("product", "name")
    )

    @computed_field
    @property
    def untaxed(self) -> Money:
        return line_amounts(self.quantity, self.unit_price, self.tax_pct)[0]

    @computed_field
    @property
    def tax(self) -> Money:
        return line_amounts(self.quantity, self.unit_price, self.tax_pct)[1]

    @computed_field
    @property
    def total(self) -> Money:
        return line_amounts(self.quantity, self.unit_price, self.tax_pct)[2]


class _DocumentOut(ORMModel):
    """Fields shared by all four document headers."""

    id: str
    number: str
    reference: str | None
    total: Money
    untaxed_total: Money
    tax_total: Money


class _PostedDocumentOut(_DocumentOut):
    """Bills and invoices: the two that post, get paid, and can be mailed."""

    due_date: date | None
    amount_paid: Money
    journal_entry_id: str | None
    last_sent_at: datetime | None = None
    last_send_error: str | None = None

    @computed_field
    @property
    def amount_due(self) -> Money:
        """Never stored. `amount_paid` is a cached figure for list screens; the
        remaining balance is derived from it so the two cannot disagree."""
        return self.total - self.amount_paid


# ── Purchase chain ────────────────────────────────────────────────────────────


class PurchaseOrderCreate(BaseModel):
    vendor_id: str
    order_date: date | None = None
    reference: str | None = Field(default=None, max_length=120)
    lines: list[DocumentLineIn] = Field(default_factory=list)


class PurchaseOrderUpdate(BaseModel):
    vendor_id: str | None = None
    order_date: date | None = None
    reference: str | None = Field(default=None, max_length=120)
    lines: list[DocumentLineIn] | None = None


class PurchaseOrderOut(_DocumentOut):
    vendor_id: str
    vendor_name: str | None = Field(
        default=None, validation_alias=AliasPath("vendor", "name")
    )
    order_date: date
    status: PurchaseOrderStatus
    lines: list[DocumentLineOut] = []


class VendorBillCreate(BaseModel):
    vendor_id: str
    bill_date: date | None = None
    due_date: date | None = None
    reference: str | None = Field(default=None, max_length=120)
    po_id: str | None = None
    lines: list[DocumentLineIn] = Field(default_factory=list)


class VendorBillUpdate(BaseModel):
    vendor_id: str | None = None
    bill_date: date | None = None
    due_date: date | None = None
    reference: str | None = Field(default=None, max_length=120)
    lines: list[DocumentLineIn] | None = None


class VendorBillOut(_PostedDocumentOut):
    vendor_id: str
    vendor_name: str | None = Field(
        default=None, validation_alias=AliasPath("vendor", "name")
    )
    po_id: str | None
    bill_date: date
    status: VendorBillStatus
    lines: list[DocumentLineOut] = []


# ── Sales chain ───────────────────────────────────────────────────────────────


class SalesOrderCreate(BaseModel):
    customer_id: str
    order_date: date | None = None
    reference: str | None = Field(default=None, max_length=120)
    lines: list[DocumentLineIn] = Field(default_factory=list)


class SalesOrderUpdate(BaseModel):
    customer_id: str | None = None
    order_date: date | None = None
    reference: str | None = Field(default=None, max_length=120)
    lines: list[DocumentLineIn] | None = None


class SalesOrderOut(_DocumentOut):
    customer_id: str
    customer_name: str | None = Field(
        default=None, validation_alias=AliasPath("customer", "name")
    )
    order_date: date
    status: SalesOrderStatus
    lines: list[DocumentLineOut] = []


class CustomerInvoiceCreate(BaseModel):
    customer_id: str
    invoice_date: date | None = None
    due_date: date | None = None
    reference: str | None = Field(default=None, max_length=120)
    so_id: str | None = None
    lines: list[DocumentLineIn] = Field(default_factory=list)


class CustomerInvoiceUpdate(BaseModel):
    customer_id: str | None = None
    invoice_date: date | None = None
    due_date: date | None = None
    reference: str | None = Field(default=None, max_length=120)
    lines: list[DocumentLineIn] | None = None


class CustomerInvoiceOut(_PostedDocumentOut):
    customer_id: str
    customer_name: str | None = Field(
        default=None, validation_alias=AliasPath("customer", "name")
    )
    so_id: str | None
    invoice_date: date
    status: CustomerInvoiceStatus
    lines: list[DocumentLineOut] = []
