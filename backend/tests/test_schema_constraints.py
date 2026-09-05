"""Constraints that live in the database itself, per docs/03_DATA_MODEL.md §3/§4/§6.

These need no service layer — a CHECK/UNIQUE constraint either holds or it doesn't,
independent of any Python code above it. They run today, against schema alone, and
they must never regress even after posting.py/payments.py exist, because those
modules are the *second* line of defence, not the first.
"""

from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import (
    Account,
    Budget,
    BudgetLine,
    Contact,
    CustomerInvoiceLine,
    JournalEntry,
    JournalLine,
    Payment,
)
from app.models.enums import AccountType, ContactType, EntryState, PaymentDirection


# ---------------------------------------------------------------------------
# Rule 1 / 2 — a journal line is one-sided, non-negative, never empty
# ---------------------------------------------------------------------------


def test_journal_line_rejects_both_debit_and_credit(db, chart_of_accounts, journals, today):
    entry = JournalEntry(
        entry_number="JE/2026/00001",
        journal_id=journals["sales"].id,
        entry_date=today,
        source_type="manual",
    )
    db.add(entry)
    db.flush()
    db.add(
        JournalLine(
            entry_id=entry.id,
            account_id=chart_of_accounts["debtors"].id,
            debit=100,
            credit=50,
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()


def test_journal_line_rejects_empty_line(db, chart_of_accounts, journals, today):
    entry = JournalEntry(
        entry_number="JE/2026/00002",
        journal_id=journals["sales"].id,
        entry_date=today,
        source_type="manual",
    )
    db.add(entry)
    db.flush()
    db.add(JournalLine(entry_id=entry.id, account_id=chart_of_accounts["debtors"].id))
    with pytest.raises(IntegrityError):
        db.flush()


def test_journal_line_rejects_negative_amount(db, chart_of_accounts, journals, today):
    entry = JournalEntry(
        entry_number="JE/2026/00003",
        journal_id=journals["sales"].id,
        entry_date=today,
        source_type="manual",
    )
    db.add(entry)
    db.flush()
    db.add(JournalLine(entry_id=entry.id, account_id=chart_of_accounts["debtors"].id, debit=-10))
    with pytest.raises(IntegrityError):
        db.flush()


def test_journal_line_accepts_a_single_sided_line(db, chart_of_accounts, journals, today):
    entry = JournalEntry(
        entry_number="JE/2026/00004",
        journal_id=journals["sales"].id,
        entry_date=today,
        source_type="manual",
    )
    db.add(entry)
    db.flush()
    db.add(JournalLine(entry_id=entry.id, account_id=chart_of_accounts["debtors"].id, debit=100))
    db.flush()  # must not raise


# ---------------------------------------------------------------------------
# Rule 7 — a document cannot post twice (idempotent posting, the DB backstop)
# ---------------------------------------------------------------------------


def test_only_one_live_entry_per_source_document(db, journals, today):
    source_id = "11111111-1111-1111-1111-111111111111"
    db.add(
        JournalEntry(
            entry_number="JE/2026/00010",
            journal_id=journals["sales"].id,
            entry_date=today,
            source_type="customer_invoice",
            source_id=source_id,
            state=EntryState.POSTED,
        )
    )
    db.flush()
    db.add(
        JournalEntry(
            entry_number="JE/2026/00011",
            journal_id=journals["sales"].id,
            entry_date=today,
            source_type="customer_invoice",
            source_id=source_id,
            state=EntryState.POSTED,
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()


def test_a_reversed_entry_frees_the_source_document_for_reposting(db, journals, today):
    """A REVERSED entry does not count against the unique-live-entry guard."""
    source_id = "22222222-2222-2222-2222-222222222222"
    db.add(
        JournalEntry(
            entry_number="JE/2026/00012",
            journal_id=journals["sales"].id,
            entry_date=today,
            source_type="customer_invoice",
            source_id=source_id,
            state=EntryState.REVERSED,
        )
    )
    db.flush()
    db.add(
        JournalEntry(
            entry_number="JE/2026/00013",
            journal_id=journals["sales"].id,
            entry_date=today,
            source_type="customer_invoice",
            source_id=source_id,
            state=EntryState.POSTED,
        )
    )
    db.flush()  # must not raise


# ---------------------------------------------------------------------------
# Uniqueness the statement calls out explicitly (docs/03_DATA_MODEL.md §6)
# ---------------------------------------------------------------------------


def test_account_code_must_be_unique(db):
    db.add(Account(code="9999", name="Duplicate A", type=AccountType.ASSET))
    db.flush()
    db.add(Account(code="9999", name="Duplicate B", type=AccountType.ASSET))
    with pytest.raises(IntegrityError):
        db.flush()


def test_contact_email_must_be_unique(db):
    db.add(Contact(name="A", type=ContactType.CUSTOMER, email="dup@example.test"))
    db.flush()
    db.add(Contact(name="B", type=ContactType.CUSTOMER, email="dup@example.test"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_journal_entry_number_must_be_unique(db, journals, today):
    db.add(
        JournalEntry(
            entry_number="JE/2026/00099",
            journal_id=journals["sales"].id,
            entry_date=today,
            source_type="manual",
        )
    )
    db.flush()
    db.add(
        JournalEntry(
            entry_number="JE/2026/00099",
            journal_id=journals["sales"].id,
            entry_date=today,
            source_type="manual",
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()


def test_payment_idempotency_key_must_be_unique(db, customer, journals, today):
    from app.models import CustomerInvoice

    invoice = CustomerInvoice(number="INV/2026/9001", customer_id=customer.id, invoice_date=today)
    db.add(invoice)
    db.flush()

    kwargs = dict(
        contact_id=customer.id,
        direction=PaymentDirection.RECEIVE,
        journal_id=journals["bank"].id,
        amount=100,
        payment_date=today,
        idempotency_key="same-key",
        invoice_id=invoice.id,
        bill_id=None,
    )
    db.add(Payment(number="PMT-0001", **kwargs))
    db.flush()
    with pytest.raises(IntegrityError):
        db.add(Payment(number="PMT-0002", **kwargs))
        db.flush()


# ---------------------------------------------------------------------------
# Payment: exactly one target (invoice XOR bill), amount > 0
# ---------------------------------------------------------------------------


def test_payment_rejects_zero_targets(db, customer, journals, today):
    db.add(
        Payment(
            number="PMT-0010",
            contact_id=customer.id,
            direction=PaymentDirection.RECEIVE,
            journal_id=journals["bank"].id,
            amount=100,
            payment_date=today,
            idempotency_key="k-0010",
            invoice_id=None,
            bill_id=None,
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()


def test_payment_rejects_both_targets(db, customer, vendor, journals, today):
    from app.models import CustomerInvoice, VendorBill

    invoice = CustomerInvoice(number="INV/2026/9002", customer_id=customer.id, invoice_date=today)
    bill = VendorBill(number="Bill/2026/9002", vendor_id=vendor.id, bill_date=today)
    db.add_all([invoice, bill])
    db.flush()
    db.add(
        Payment(
            number="PMT-0011",
            contact_id=customer.id,
            direction=PaymentDirection.RECEIVE,
            journal_id=journals["bank"].id,
            amount=100,
            payment_date=today,
            idempotency_key="k-0011",
            invoice_id=invoice.id,
            bill_id=bill.id,
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()


def test_payment_rejects_non_positive_amount(db, customer, journals, today):
    from app.models import CustomerInvoice

    invoice = CustomerInvoice(number="INV/2026/9003", customer_id=customer.id, invoice_date=today)
    db.add(invoice)
    db.flush()
    db.add(
        Payment(
            number="PMT-0012",
            contact_id=customer.id,
            direction=PaymentDirection.RECEIVE,
            journal_id=journals["bank"].id,
            amount=0,
            payment_date=today,
            idempotency_key="k-0012",
            invoice_id=invoice.id,
            bill_id=None,
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()


# ---------------------------------------------------------------------------
# Document lines: quantity > 0, unit_price >= 0
# ---------------------------------------------------------------------------


def test_document_line_rejects_zero_quantity(db, chart_of_accounts, customer, product, today):
    from app.models import CustomerInvoice

    invoice = CustomerInvoice(
        number="INV/2026/0001", customer_id=customer.id, invoice_date=today
    )
    db.add(invoice)
    db.flush()
    db.add(
        CustomerInvoiceLine(
            document_id=invoice.id,
            product_id=product.id,
            account_id=chart_of_accounts["sales_income"].id,
            quantity=0,
            unit_price=100,
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()


def test_document_line_rejects_negative_unit_price(db, chart_of_accounts, customer, product, today):
    from app.models import CustomerInvoice

    invoice = CustomerInvoice(
        number="INV/2026/0002", customer_id=customer.id, invoice_date=today
    )
    db.add(invoice)
    db.flush()
    db.add(
        CustomerInvoiceLine(
            document_id=invoice.id,
            product_id=product.id,
            account_id=chart_of_accounts["sales_income"].id,
            quantity=1,
            unit_price=-5,
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()


# ---------------------------------------------------------------------------
# Budgets: period_end > period_start, one line per analytic account
# ---------------------------------------------------------------------------


def test_budget_rejects_period_end_before_start(db):
    db.add(Budget(name="Q1", period_start=date(2026, 3, 1), period_end=date(2026, 1, 1)))
    with pytest.raises(IntegrityError):
        db.flush()


def test_budget_line_unique_per_analytic_account(db, analytic_accounts):
    budget = Budget(name="Q1", period_start=date(2026, 1, 1), period_end=date(2026, 3, 31))
    db.add(budget)
    db.flush()
    db.add(
        BudgetLine(
            budget_id=budget.id,
            analytic_account_id=analytic_accounts["income"].id,
            committed_amount=1000,
        )
    )
    db.flush()
    db.add(
        BudgetLine(
            budget_id=budget.id,
            analytic_account_id=analytic_accounts["income"].id,
            committed_amount=500,
        )
    )
    with pytest.raises(IntegrityError):
        db.flush()
