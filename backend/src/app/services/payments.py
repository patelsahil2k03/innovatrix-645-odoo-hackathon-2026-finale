"""Registering a payment — one payment settles one document.

Partial payment is simply an amount smaller than the balance; the document moves
to PARTIAL rather than PAID. There is no allocation table, deliberately: the
mockup raises payment from a single document's Pay button with the partner and
amount pre-filled from it, and a join table would complicate the one screen that
has to be flawless (03_DATA_MODEL.md §4).

Everything here happens in one transaction: the target document is locked, its
remaining balance is re-checked under that lock, the payment row and its journal
entry are written, and the document's cached `amount_paid` and status move
together. The router commits and then emits.
"""

import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.base import utc_now
from app.models.documents import (
    CustomerInvoice,
    CustomerInvoiceStatus,
    VendorBill,
    VendorBillStatus,
)
from app.models.masters import Account, Contact, Journal, JournalType
from app.models.payments import Payment, PaymentDirection
from app.services.money import q2
from app.services.numbering import next_number
from app.services.posting import LineDraft, post_entry
from app.services.rules import lock_row

logger = logging.getLogger(__name__)

ZERO = Decimal("0.00")

MONEY_JOURNAL_TYPES = (JournalType.BANK, JournalType.CASH)

# The statuses that can still receive money. DRAFT cannot: there is no ledger
# entry behind it yet, so a payment would have no receivable to settle.
PAYABLE_INVOICE_STATES = (CustomerInvoiceStatus.POSTED, CustomerInvoiceStatus.PARTIAL)
PAYABLE_BILL_STATES = (VendorBillStatus.POSTED, VendorBillStatus.PARTIAL)


def find_by_idempotency_key(db: Session, key: str) -> Payment | None:
    """A retry is not an error.

    A double-clicked Pay button sends the same key twice; the second request gets
    the first payment back rather than creating a second one. Without this the
    books are quietly wrong in a way a balanced trial balance will never show —
    both entries balance perfectly, there are simply two of them.
    """
    return db.execute(
        select(Payment).where(Payment.idempotency_key == key)
    ).scalar_one_or_none()


def _money_account(db: Session, journal: Journal) -> Account:
    """The bank or cash account a payment moves through.

    For a BANK or CASH journal the default debit account *is* the money account
    (03_DATA_MODEL.md §2); the credit default is accepted as a fallback so a
    journal configured with only one side still works.
    """
    account_id = journal.default_debit_account_id or journal.default_credit_account_id
    if account_id is None:
        raise AppError(
            "MISSING_ACCOUNT_MAPPING",
            f"The {journal.name} journal has no bank or cash account set, so a "
            "payment cannot be posted through it.",
            fields={"journal_id": "This journal has no money account."},
        )
    return db.get(Account, account_id)


def _resolve_journal(db: Session, journal_id: str | None) -> Journal:
    """Bank is the default the mockup draws; anything that is not BANK or CASH
    is refused rather than silently corrected."""
    if journal_id is None:
        journal = db.execute(
            select(Journal).where(
                Journal.type == JournalType.BANK, Journal.is_archived.is_(False)
            )
        ).scalars().first()
        if journal is None:
            raise AppError(
                "MISSING_ACCOUNT_MAPPING", "No Bank journal exists to pay through."
            )
        return journal

    journal = db.get(Journal, journal_id)
    if journal is None:
        raise AppError(
            "NOT_FOUND", "That journal no longer exists.", 404,
            fields={"journal_id": "Unknown journal."},
        )
    if journal.type not in MONEY_JOURNAL_TYPES:
        raise AppError(
            "INVALID_JOURNAL_TYPE",
            "A payment must go through a Bank or Cash journal.",
            fields={"journal_id": "Choose a Bank or Cash journal."},
        )
    return journal


def register_payment(
    db: Session,
    payload,
    *,
    idempotency_key: str,
    actor_id: str | None,
    contact_scope: str | None = None,
) -> tuple[Payment, bool]:
    """Record and post one payment. Returns `(payment, was_created)`.

    `was_created` is False when an idempotency key is replayed, so the router can
    answer 200 with the original instead of 201 with a duplicate.

    `contact_scope`, when set, restricts the payment to documents belonging to
    that contact — the portal passes its own caller's `contact_id` so a contact
    can never pay against someone else's document. It is a data-scoping filter,
    not a role, which is why it lives here rather than in the RBAC dependency.
    """
    existing = find_by_idempotency_key(db, idempotency_key)
    if existing is not None:
        return existing, False

    journal = _resolve_journal(db, payload.journal_id)
    amount = q2(Decimal(payload.amount))
    if amount <= ZERO:
        raise AppError(
            "VALIDATION_ERROR", "A payment must be for more than zero.",
            fields={"amount": "Must be greater than zero."},
        )

    # 1 — LOCK the document, 2 — re-check its state and balance under that lock.
    if payload.invoice_id:
        document = lock_row(db, CustomerInvoice, payload.invoice_id)
        label, field_name = "invoice", "invoice_id"
        payable_states = PAYABLE_INVOICE_STATES
        direction = PaymentDirection.RECEIVE
        contact_id = getattr(document, "customer_id", None)
    else:
        document = lock_row(db, VendorBill, payload.bill_id)
        label, field_name = "bill", "bill_id"
        payable_states = PAYABLE_BILL_STATES
        direction = PaymentDirection.SEND
        contact_id = getattr(document, "vendor_id", None)

    if document is None:
        raise AppError("NOT_FOUND", f"That {label} no longer exists.", 404)

    # The portal's scoping check is a 404, never a 403: a 403 would confirm the
    # document exists, which leaks one contact's records to another.
    if contact_scope is not None and contact_id != contact_scope:
        raise AppError("NOT_FOUND", f"That {label} no longer exists.", 404)

    if document.status not in payable_states:
        raise AppError(
            "INVALID_STATUS_TRANSITION",
            f"This {label} is {document.status.value} — only a posted "
            f"{label} can receive a payment.",
        )

    balance = q2(Decimal(document.total) - Decimal(document.amount_paid))
    if amount > balance:
        raise AppError(
            "OVERALLOCATED_PAYMENT",
            f"That is more than the {balance} still outstanding on this {label}.",
            fields={"amount": f"Must be at most {balance}."},
        )

    contact = db.get(Contact, contact_id)
    money = _money_account(db, journal)

    if direction is PaymentDirection.RECEIVE:
        if contact.receivable_account_id is None:
            raise AppError(
                "MISSING_ACCOUNT_MAPPING",
                f"{contact.name} has no receivable account set.",
            )
        counterpart = db.get(Account, contact.receivable_account_id)
        # Dr Bank/Cash, Cr Accounts Receivable
        draft_lines = [
            LineDraft(
                account=money, debit=amount,
                label=f"Received from {contact.name}", partner_id=contact.id,
            ),
            LineDraft(
                account=counterpart, credit=amount,
                label=f"Settlement of {document.number}", partner_id=contact.id,
            ),
        ]
    else:
        if contact.payable_account_id is None:
            raise AppError(
                "MISSING_ACCOUNT_MAPPING", f"{contact.name} has no payable account set."
            )
        counterpart = db.get(Account, contact.payable_account_id)
        # Dr Accounts Payable, Cr Bank/Cash
        draft_lines = [
            LineDraft(
                account=counterpart, debit=amount,
                label=f"Settlement of {document.number}", partner_id=contact.id,
            ),
            LineDraft(
                account=money, credit=amount,
                label=f"Paid to {contact.name}", partner_id=contact.id,
            ),
        ]

    # Defaults to today, per the mockup's Pay form. UTC, never local — see
    # 10_LESSONS.md §8 on the date.today()/datetime.now(UTC) mismatch.
    payment_date = payload.payment_date or utc_now().date()

    payment = Payment(
        number=next_number(db, "pay", payment_date.year),
        contact_id=contact.id,
        # Direction is re-derived from the target document, never taken from the
        # request: the client pre-fills it for display, but a client that sends
        # SEND against a customer invoice must not be able to reverse the books.
        direction=direction,
        journal_id=journal.id,
        amount=amount,
        payment_date=payment_date,
        note=payload.note,
        invoice_id=payload.invoice_id,
        bill_id=payload.bill_id,
        idempotency_key=idempotency_key,
    )
    db.add(payment)
    db.flush()

    entry = post_entry(
        db,
        journal=journal,
        entry_date=payment_date,
        reference=f"{payment.number} / {document.number}",
        source_type="payment",
        source_id=payment.id,
        lines=draft_lines,
        actor_id=actor_id,
    )
    payment.journal_entry_id = entry.id

    # 3 — mutate the document: cached total first, then the status it implies.
    document.amount_paid = q2(Decimal(document.amount_paid) + amount)
    remaining = q2(Decimal(document.total) - Decimal(document.amount_paid))
    if payload.invoice_id:
        document.status = (
            CustomerInvoiceStatus.PAID if remaining <= ZERO
            else CustomerInvoiceStatus.PARTIAL
        )
    else:
        document.status = (
            VendorBillStatus.PAID if remaining <= ZERO else VendorBillStatus.PARTIAL
        )

    db.flush()
    return payment, True
