"""The two document chains — purchase and sales — and the four postings they make.

    Purchase Order  DRAFT -> CONFIRMED -> BILLED -> (CANCELLED)
    Vendor Bill     DRAFT -> POSTED -> PARTIAL -> PAID -> (CANCELLED)
    Sales Order     DRAFT -> CONFIRMED -> INVOICED -> (CANCELLED)
    Customer Inv.   DRAFT -> POSTED -> PARTIAL -> PAID -> (CANCELLED)

Every transition here follows the locking discipline from 06_BACKEND.md §4 — lock
the row, re-check its state *after* the lock, mutate, and let the router commit and
emit. The re-check is the step that matters: a status read before the lock is a
status that may already be stale, and two concurrent posts of one invoice produce
two journal entries that a balanced trial balance will never reveal.

Nothing in this file writes a journal line directly. Posting goes through
`services/posting.py`, which is the only module allowed to.
"""

import logging
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.settings import get_settings
from app.models.base import utc_now
from app.models.documents import (
    CustomerInvoice,
    CustomerInvoiceLine,
    CustomerInvoiceStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderStatus,
    SalesOrder,
    SalesOrderLine,
    SalesOrderStatus,
    VendorBill,
    VendorBillLine,
    VendorBillStatus,
)
from app.models.ledger import JournalEntry
from app.models.masters import (
    Account,
    Contact,
    ContactType,
    Journal,
    JournalType,
    Product,
)
from app.services.money import document_totals, line_amounts
from app.services.numbering import next_number
from app.services.posting import LineDraft, post_entry, reverse_entry
from app.services.rules import lock_row, require

logger = logging.getLogger(__name__)
settings = get_settings()

ZERO = Decimal("0.00")

SALES_CONTACT_TYPES = (ContactType.CUSTOMER, ContactType.BOTH)
PURCHASE_CONTACT_TYPES = (ContactType.VENDOR, ContactType.BOTH)


# ── shared helpers ────────────────────────────────────────────────────────────


def _today() -> date:
    """UTC, never local. Mixing `date.today()` with `datetime.now(UTC)` broke
    three tests on every IST machine last round (10_LESSONS.md §8)."""
    return utc_now().date()


def get_or_404(db: Session, model, row_id: str, label: str):
    row = db.get(model, row_id)
    if row is None:
        raise AppError("NOT_FOUND", f"That {label} no longer exists.", status_code=404)
    return row


def _resolve_contact(db: Session, contact_id: str, *, for_sale: bool) -> Contact:
    """Fetch the partner and reject the wrong side of the business.

    A vendor on a sales invoice is `CONTACT_TYPE_MISMATCH`, not a quiet success —
    it would post a receivable against someone who is not a customer, and the
    error only becomes visible in an aged-receivables report weeks later.
    """
    contact = db.get(Contact, contact_id)
    if contact is None:
        raise AppError(
            "NOT_FOUND", "That contact no longer exists.", status_code=404,
            fields={"contact_id": "Unknown contact."},
        )
    allowed = SALES_CONTACT_TYPES if for_sale else PURCHASE_CONTACT_TYPES
    if contact.type not in allowed:
        wanted = "a customer" if for_sale else "a vendor"
        raise AppError(
            "CONTACT_TYPE_MISMATCH",
            f"{contact.name} is not {wanted}, so this document cannot be raised "
            "against them.",
            fields={"customer_id" if for_sale else "vendor_id": f"Must be {wanted}."},
        )
    require(
        not contact.is_archived,
        "CONTACT_ARCHIVED",
        f"{contact.name} is archived and cannot be used on a new document.",
    )
    return contact


def system_account(db: Session, code: str, label: str) -> Account:
    """The tax accounts, looked up by their configured code (settings.py).

    Raises `MISSING_ACCOUNT_MAPPING` rather than posting to a fallback: a tax
    amount silently landing in the wrong account is worse than a refused post.
    """
    account = db.execute(select(Account).where(Account.code == code)).scalar_one_or_none()
    if account is None:
        raise AppError(
            "MISSING_ACCOUNT_MAPPING",
            f"The {label} account (code {code}) is not in the chart of accounts.",
        )
    return account


def _build_lines(
    db: Session, line_model, fk_name: str, doc_id: str, lines_in, *, for_sale: bool
) -> list:
    """Turn inbound line payloads into rows, snapshotting price, tax and account.

    The snapshot is the rule from 03_DATA_MODEL.md §6: `tax_pct` and `account_id`
    are copied from the product *now* and never re-read from it afterwards, so a
    price rise next month cannot silently rewrite last month's invoice. Anything
    the caller supplies explicitly wins over the product default — the line is
    editable at the moment it is created, and frozen from then on.
    """
    rows = []
    for payload in lines_in:
        product = db.get(Product, payload.product_id)
        if product is None:
            raise AppError(
                "NOT_FOUND", "That product no longer exists.", status_code=404,
                fields={"product_id": "Unknown product."},
            )
        require(
            not product.is_archived,
            "PRODUCT_ARCHIVED",
            f"{product.name} is archived and cannot be added to a new document.",
        )

        default_account = (
            product.income_account_id if for_sale else product.expense_account_id
        )
        account_id = payload.account_id or default_account
        if account_id is None:
            raise AppError(
                "MISSING_ACCOUNT_MAPPING",
                f"{product.name} has no "
                f"{'income' if for_sale else 'expense'} account set, so it cannot "
                "be posted. Set one on the product or pick an account on the line.",
                fields={"account_id": "Required — this product has no default."},
            )

        unit_price = payload.unit_price
        if unit_price is None:
            unit_price = product.sales_price if for_sale else product.cost_price

        tax_pct = payload.tax_pct
        if tax_pct is None:
            tax_pct = product.sales_tax_pct

        row = line_model(
            product_id=product.id,
            account_id=account_id,
            analytic_account_id=payload.analytic_account_id,
            quantity=Decimal(payload.quantity),
            unit_price=Decimal(unit_price),
            tax_pct=Decimal(tax_pct),
        )
        setattr(row, fk_name, doc_id)
        rows.append(row)
    return rows


def _apply_totals(doc) -> None:
    """Recompute the header from its lines. Called after any line change."""
    untaxed, tax, total = document_totals(doc.lines)
    doc.untaxed_total = untaxed
    doc.tax_total = tax
    doc.total = total


def _require_lines(doc) -> None:
    require(
        len(doc.lines) > 0,
        "EMPTY_DOCUMENT",
        "Add at least one line before confirming or posting this document.",
    )


def _require_postable_total(doc, label: str) -> None:
    """A document worth 0.00 has no entry to make.

    Distinct from EMPTY_DOCUMENT: this one *has* lines, they simply come to
    nothing — every line free, or quantities against a zero price. Rejecting it
    with its own message beats letting the posting engine fail on a constraint
    the user cannot see.
    """
    if Decimal(doc.total) <= ZERO:
        raise AppError(
            "EMPTY_DOCUMENT",
            f"This {label} totals 0.00, so there is nothing to post.",
        )


def _journal_of_type(db: Session, journal_type: JournalType) -> Journal:
    journal = db.execute(
        select(Journal).where(
            Journal.type == journal_type, Journal.is_archived.is_(False)
        )
    ).scalars().first()
    if journal is None:
        raise AppError(
            "MISSING_ACCOUNT_MAPPING",
            f"No {journal_type.value.title()} journal exists to post into.",
        )
    return journal


def _require_draft(doc, expected, label: str) -> None:
    """Re-check state after the lock (06_BACKEND.md §4, step 2)."""
    if doc.status is not expected:
        raise AppError(
            "INVALID_STATUS_TRANSITION",
            f"This {label} is {doc.status.value}, so that action is not available.",
        )


def _guard_cancellable(doc, label: str) -> None:
    """Money already collected is never cancelled away.

    A raw cancel on a document with payments against it orphans those payments:
    the cash is in the bank, the ledger says so, and the document that explained
    it is gone. The correct instrument is a reversing correction, not a delete.
    """
    if getattr(doc, "amount_paid", ZERO) and Decimal(doc.amount_paid) > ZERO:
        raise AppError(
            "CANNOT_CANCEL_WITH_PAYMENTS",
            f"This {label} has payments recorded against it — reverse or refund "
            "those first.",
            status_code=409,
        )


# ── Purchase chain ────────────────────────────────────────────────────────────


def create_purchase_order(db: Session, payload) -> PurchaseOrder:
    vendor = _resolve_contact(db, payload.vendor_id, for_sale=False)
    order_date = payload.order_date or _today()

    order = PurchaseOrder(
        number=next_number(db, "po"),
        reference=payload.reference,
        vendor_id=vendor.id,
        order_date=order_date,
        status=PurchaseOrderStatus.DRAFT,
    )
    db.add(order)
    db.flush()
    order.lines = _build_lines(
        db, PurchaseOrderLine, "order_id", order.id, payload.lines, for_sale=False
    )
    _apply_totals(order)
    db.flush()
    return order


def update_purchase_order(db: Session, order_id: str, payload) -> PurchaseOrder:
    order = lock_row(db, PurchaseOrder, order_id)
    if order is None:
        raise AppError("NOT_FOUND", "That purchase order no longer exists.", 404)
    _require_draft(order, PurchaseOrderStatus.DRAFT, "purchase order")

    if payload.vendor_id is not None:
        order.vendor_id = _resolve_contact(db, payload.vendor_id, for_sale=False).id
    if payload.order_date is not None:
        order.order_date = payload.order_date
    if payload.reference is not None:
        order.reference = payload.reference
    if payload.lines is not None:
        order.lines = _build_lines(
            db, PurchaseOrderLine, "order_id", order.id, payload.lines, for_sale=False
        )
    _apply_totals(order)
    db.flush()
    return order


def confirm_purchase_order(db: Session, order_id: str) -> PurchaseOrder:
    order = lock_row(db, PurchaseOrder, order_id)
    if order is None:
        raise AppError("NOT_FOUND", "That purchase order no longer exists.", 404)
    _require_draft(order, PurchaseOrderStatus.DRAFT, "purchase order")
    _require_lines(order)

    order.status = PurchaseOrderStatus.CONFIRMED
    _apply_totals(order)
    db.flush()
    return order


def create_bill_from_po(db: Session, order_id: str, payload=None) -> VendorBill:
    """Convert a confirmed PO into a draft bill, copying its lines faithfully."""
    order = lock_row(db, PurchaseOrder, order_id)
    if order is None:
        raise AppError("NOT_FOUND", "That purchase order no longer exists.", 404)
    _require_draft(order, PurchaseOrderStatus.CONFIRMED, "purchase order")
    _require_lines(order)

    bill_date = getattr(payload, "bill_date", None) or _today()
    bill = VendorBill(
        number=next_number(db, "bill", bill_date.year),
        reference=getattr(payload, "reference", None) or order.reference,
        po_id=order.id,
        vendor_id=order.vendor_id,
        bill_date=bill_date,
        due_date=getattr(payload, "due_date", None),
        status=VendorBillStatus.DRAFT,
    )
    db.add(bill)
    db.flush()

    # Copied field for field, including the snapshotted tax rate and account —
    # the bill must say what the order said, not what the product says today.
    bill.lines = [
        VendorBillLine(
            bill_id=bill.id,
            product_id=line.product_id,
            account_id=line.account_id,
            analytic_account_id=line.analytic_account_id,
            quantity=line.quantity,
            unit_price=line.unit_price,
            tax_pct=line.tax_pct,
        )
        for line in order.lines
    ]
    _apply_totals(bill)
    order.status = PurchaseOrderStatus.BILLED
    db.flush()
    return bill


def create_vendor_bill(db: Session, payload) -> VendorBill:
    """A bill raised directly, with no purchase order behind it (§4)."""
    vendor = _resolve_contact(db, payload.vendor_id, for_sale=False)
    bill_date = payload.bill_date or _today()

    bill = VendorBill(
        number=next_number(db, "bill", bill_date.year),
        reference=payload.reference,
        po_id=payload.po_id,
        vendor_id=vendor.id,
        bill_date=bill_date,
        due_date=payload.due_date,
        status=VendorBillStatus.DRAFT,
    )
    db.add(bill)
    db.flush()
    bill.lines = _build_lines(
        db, VendorBillLine, "bill_id", bill.id, payload.lines, for_sale=False
    )
    _apply_totals(bill)
    db.flush()
    return bill


def update_vendor_bill(db: Session, bill_id: str, payload) -> VendorBill:
    bill = lock_row(db, VendorBill, bill_id)
    if bill is None:
        raise AppError("NOT_FOUND", "That vendor bill no longer exists.", 404)
    if bill.status is not VendorBillStatus.DRAFT:
        raise AppError(
            "CANNOT_MODIFY_POSTED",
            "A posted bill cannot be edited — reverse it and raise a correction.",
            status_code=409,
        )

    if payload.vendor_id is not None:
        bill.vendor_id = _resolve_contact(db, payload.vendor_id, for_sale=False).id
    if payload.bill_date is not None:
        bill.bill_date = payload.bill_date
    if payload.due_date is not None:
        bill.due_date = payload.due_date
    if payload.reference is not None:
        bill.reference = payload.reference
    if payload.lines is not None:
        bill.lines = _build_lines(
            db, VendorBillLine, "bill_id", bill.id, payload.lines, for_sale=False
        )
    _apply_totals(bill)
    db.flush()
    return bill


def post_vendor_bill(db: Session, bill_id: str, *, actor_id: str | None) -> VendorBill:
    """Post a vendor bill (03_DATA_MODEL.md §5).

        Dr  Purchase Expense (product.expense_account)   per line, untaxed
        Dr  Input Tax                                    tax_total
            Cr  Accounts Payable (contact.payable)         total
    """
    bill = lock_row(db, VendorBill, bill_id)
    if bill is None:
        raise AppError("NOT_FOUND", "That vendor bill no longer exists.", 404)
    _require_draft(bill, VendorBillStatus.DRAFT, "bill")
    _require_lines(bill)
    _apply_totals(bill)

    vendor = db.get(Contact, bill.vendor_id)
    if vendor.payable_account_id is None:
        raise AppError(
            "MISSING_ACCOUNT_MAPPING",
            f"{vendor.name} has no payable account set, so this bill cannot post.",
        )
    payable = db.get(Account, vendor.payable_account_id)

    _require_postable_total(bill, "bill")

    lines: list[LineDraft] = []
    # One journal line per document line rather than one per account: it keeps
    # the analytic tag and the product name on the ledger line, which is what
    # makes the report drill-down land on something a human recognises.
    for line in bill.lines:
        untaxed, _, _ = line_amounts(line.quantity, line.unit_price, line.tax_pct)
        if untaxed == ZERO:
            # A zero-value line posts nothing. Emitting it anyway would breach
            # `CHECK (debit > 0 OR credit > 0)` and fail the whole posting — a
            # free line on an otherwise ordinary bill is legitimate, and must
            # not be able to block it.
            continue
        lines.append(
            LineDraft(
                account=db.get(Account, line.account_id),
                debit=untaxed,
                label=f"{line.product.name} x {line.quantity}",
                analytic_account_id=line.analytic_account_id,
                partner_id=vendor.id,
            )
        )

    if Decimal(bill.tax_total) > ZERO:
        lines.append(
            LineDraft(
                account=system_account(db, settings.input_tax_account_code, "Input Tax"),
                debit=Decimal(bill.tax_total),
                label=f"Input tax on {bill.number}",
                partner_id=vendor.id,
            )
        )

    lines.append(
        LineDraft(
            account=payable,
            credit=Decimal(bill.total),
            label=f"{vendor.name} — {bill.number}",
            partner_id=vendor.id,
        )
    )

    entry = post_entry(
        db,
        journal=_journal_of_type(db, JournalType.PURCHASE),
        entry_date=bill.bill_date,
        reference=bill.number,
        source_type="vendor_bill",
        source_id=bill.id,
        lines=lines,
        actor_id=actor_id,
    )
    bill.journal_entry_id = entry.id
    bill.status = VendorBillStatus.POSTED
    db.flush()
    return bill


def cancel_vendor_bill(db: Session, bill_id: str, *, actor_id: str | None) -> VendorBill:
    bill = lock_row(db, VendorBill, bill_id)
    if bill is None:
        raise AppError("NOT_FOUND", "That vendor bill no longer exists.", 404)
    if bill.status is VendorBillStatus.CANCELLED:
        raise AppError(
            "INVALID_STATUS_TRANSITION", "This bill is already cancelled."
        )
    _guard_cancellable(bill, "bill")

    if bill.journal_entry_id:
        entry = db.get(JournalEntry, bill.journal_entry_id)
        if entry is not None:
            reverse_entry(
                db, entry, actor_id=actor_id, reason=f"Cancellation of {bill.number}"
            )
    bill.status = VendorBillStatus.CANCELLED
    db.flush()
    return bill


def cancel_purchase_order(db: Session, order_id: str) -> PurchaseOrder:
    order = lock_row(db, PurchaseOrder, order_id)
    if order is None:
        raise AppError("NOT_FOUND", "That purchase order no longer exists.", 404)
    if order.status is PurchaseOrderStatus.BILLED:
        raise AppError(
            "INVALID_STATUS_TRANSITION",
            "This order has already been billed — cancel the bill instead.",
        )
    if order.status is PurchaseOrderStatus.CANCELLED:
        raise AppError("INVALID_STATUS_TRANSITION", "This order is already cancelled.")
    order.status = PurchaseOrderStatus.CANCELLED
    db.flush()
    return order


# ── Sales chain ───────────────────────────────────────────────────────────────


def create_sales_order(db: Session, payload) -> SalesOrder:
    customer = _resolve_contact(db, payload.customer_id, for_sale=True)
    order_date = payload.order_date or _today()

    order = SalesOrder(
        number=next_number(db, "so"),
        reference=payload.reference,
        customer_id=customer.id,
        order_date=order_date,
        status=SalesOrderStatus.DRAFT,
    )
    db.add(order)
    db.flush()
    order.lines = _build_lines(
        db, SalesOrderLine, "order_id", order.id, payload.lines, for_sale=True
    )
    _apply_totals(order)
    db.flush()
    return order


def update_sales_order(db: Session, order_id: str, payload) -> SalesOrder:
    order = lock_row(db, SalesOrder, order_id)
    if order is None:
        raise AppError("NOT_FOUND", "That sales order no longer exists.", 404)
    _require_draft(order, SalesOrderStatus.DRAFT, "sales order")

    if payload.customer_id is not None:
        order.customer_id = _resolve_contact(db, payload.customer_id, for_sale=True).id
    if payload.order_date is not None:
        order.order_date = payload.order_date
    if payload.reference is not None:
        order.reference = payload.reference
    if payload.lines is not None:
        order.lines = _build_lines(
            db, SalesOrderLine, "order_id", order.id, payload.lines, for_sale=True
        )
    _apply_totals(order)
    db.flush()
    return order


def confirm_sales_order(db: Session, order_id: str) -> SalesOrder:
    order = lock_row(db, SalesOrder, order_id)
    if order is None:
        raise AppError("NOT_FOUND", "That sales order no longer exists.", 404)
    _require_draft(order, SalesOrderStatus.DRAFT, "sales order")
    _require_lines(order)

    order.status = SalesOrderStatus.CONFIRMED
    _apply_totals(order)
    db.flush()
    return order


def create_invoice_from_so(db: Session, order_id: str, payload=None) -> CustomerInvoice:
    order = lock_row(db, SalesOrder, order_id)
    if order is None:
        raise AppError("NOT_FOUND", "That sales order no longer exists.", 404)
    _require_draft(order, SalesOrderStatus.CONFIRMED, "sales order")
    _require_lines(order)

    invoice_date = getattr(payload, "invoice_date", None) or _today()
    invoice = CustomerInvoice(
        number=next_number(db, "inv", invoice_date.year),
        reference=getattr(payload, "reference", None) or order.reference,
        so_id=order.id,
        customer_id=order.customer_id,
        invoice_date=invoice_date,
        due_date=getattr(payload, "due_date", None),
        status=CustomerInvoiceStatus.DRAFT,
    )
    db.add(invoice)
    db.flush()

    invoice.lines = [
        CustomerInvoiceLine(
            invoice_id=invoice.id,
            product_id=line.product_id,
            account_id=line.account_id,
            analytic_account_id=line.analytic_account_id,
            quantity=line.quantity,
            unit_price=line.unit_price,
            tax_pct=line.tax_pct,
        )
        for line in order.lines
    ]
    _apply_totals(invoice)
    order.status = SalesOrderStatus.INVOICED
    db.flush()
    return invoice


def create_customer_invoice(db: Session, payload) -> CustomerInvoice:
    customer = _resolve_contact(db, payload.customer_id, for_sale=True)
    invoice_date = payload.invoice_date or _today()

    invoice = CustomerInvoice(
        number=next_number(db, "inv", invoice_date.year),
        reference=payload.reference,
        so_id=payload.so_id,
        customer_id=customer.id,
        invoice_date=invoice_date,
        due_date=payload.due_date,
        status=CustomerInvoiceStatus.DRAFT,
    )
    db.add(invoice)
    db.flush()
    invoice.lines = _build_lines(
        db, CustomerInvoiceLine, "invoice_id", invoice.id, payload.lines, for_sale=True
    )
    _apply_totals(invoice)
    db.flush()
    return invoice


def update_customer_invoice(db: Session, invoice_id: str, payload) -> CustomerInvoice:
    invoice = lock_row(db, CustomerInvoice, invoice_id)
    if invoice is None:
        raise AppError("NOT_FOUND", "That invoice no longer exists.", 404)
    if invoice.status is not CustomerInvoiceStatus.DRAFT:
        raise AppError(
            "CANNOT_MODIFY_POSTED",
            "A posted invoice cannot be edited — reverse it and raise a correction.",
            status_code=409,
        )

    if payload.customer_id is not None:
        invoice.customer_id = _resolve_contact(
            db, payload.customer_id, for_sale=True
        ).id
    if payload.invoice_date is not None:
        invoice.invoice_date = payload.invoice_date
    if payload.due_date is not None:
        invoice.due_date = payload.due_date
    if payload.reference is not None:
        invoice.reference = payload.reference
    if payload.lines is not None:
        invoice.lines = _build_lines(
            db,
            CustomerInvoiceLine,
            "invoice_id",
            invoice.id,
            payload.lines,
            for_sale=True,
        )
    _apply_totals(invoice)
    db.flush()
    return invoice


def post_customer_invoice(
    db: Session, invoice_id: str, *, actor_id: str | None
) -> CustomerInvoice:
    """Post a customer invoice (03_DATA_MODEL.md §5).

        Dr  Accounts Receivable (contact.receivable)     total
            Cr  Sales Income (product.income_account)      per line, untaxed
            Cr  Output Tax                                 tax_total
    """
    invoice = lock_row(db, CustomerInvoice, invoice_id)
    if invoice is None:
        raise AppError("NOT_FOUND", "That invoice no longer exists.", 404)
    _require_draft(invoice, CustomerInvoiceStatus.DRAFT, "invoice")
    _require_lines(invoice)
    _apply_totals(invoice)

    customer = db.get(Contact, invoice.customer_id)
    if customer.receivable_account_id is None:
        raise AppError(
            "MISSING_ACCOUNT_MAPPING",
            f"{customer.name} has no receivable account set, so this invoice "
            "cannot post.",
        )
    receivable = db.get(Account, customer.receivable_account_id)

    _require_postable_total(invoice, "invoice")

    lines: list[LineDraft] = [
        LineDraft(
            account=receivable,
            debit=Decimal(invoice.total),
            label=f"{customer.name} — {invoice.number}",
            partner_id=customer.id,
        )
    ]

    for line in invoice.lines:
        untaxed, _, _ = line_amounts(line.quantity, line.unit_price, line.tax_pct)
        if untaxed == ZERO:
            # See the note in post_vendor_bill — a zero-value line contributes
            # nothing and must not break an otherwise valid posting.
            continue
        lines.append(
            LineDraft(
                account=db.get(Account, line.account_id),
                credit=untaxed,
                label=f"{line.product.name} x {line.quantity}",
                analytic_account_id=line.analytic_account_id,
                partner_id=customer.id,
            )
        )

    if Decimal(invoice.tax_total) > ZERO:
        lines.append(
            LineDraft(
                account=system_account(
                    db, settings.output_tax_account_code, "Output Tax"
                ),
                credit=Decimal(invoice.tax_total),
                label=f"Output tax on {invoice.number}",
                partner_id=customer.id,
            )
        )

    entry = post_entry(
        db,
        journal=_journal_of_type(db, JournalType.SALES),
        entry_date=invoice.invoice_date,
        reference=invoice.number,
        source_type="customer_invoice",
        source_id=invoice.id,
        lines=lines,
        actor_id=actor_id,
    )
    invoice.journal_entry_id = entry.id
    invoice.status = CustomerInvoiceStatus.POSTED
    db.flush()
    return invoice


def cancel_customer_invoice(
    db: Session, invoice_id: str, *, actor_id: str | None
) -> CustomerInvoice:
    invoice = lock_row(db, CustomerInvoice, invoice_id)
    if invoice is None:
        raise AppError("NOT_FOUND", "That invoice no longer exists.", 404)
    if invoice.status is CustomerInvoiceStatus.CANCELLED:
        raise AppError(
            "INVALID_STATUS_TRANSITION", "This invoice is already cancelled."
        )
    _guard_cancellable(invoice, "invoice")

    if invoice.journal_entry_id:
        entry = db.get(JournalEntry, invoice.journal_entry_id)
        if entry is not None:
            reverse_entry(
                db,
                entry,
                actor_id=actor_id,
                reason=f"Cancellation of {invoice.number}",
            )
    invoice.status = CustomerInvoiceStatus.CANCELLED
    db.flush()
    return invoice


def cancel_sales_order(db: Session, order_id: str) -> SalesOrder:
    order = lock_row(db, SalesOrder, order_id)
    if order is None:
        raise AppError("NOT_FOUND", "That sales order no longer exists.", 404)
    if order.status is SalesOrderStatus.INVOICED:
        raise AppError(
            "INVALID_STATUS_TRANSITION",
            "This order has already been invoiced — cancel the invoice instead.",
        )
    if order.status is SalesOrderStatus.CANCELLED:
        raise AppError("INVALID_STATUS_TRANSITION", "This order is already cancelled.")
    order.status = SalesOrderStatus.CANCELLED
    db.flush()
    return order
