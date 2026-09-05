"""Budget derived-computation tests — docs/07_TESTING_AND_REVIEW.md §1.2b.

Three figures (achieved, achieved_pct, to_achieve) are computed on read, never
stored (docs/03_DATA_MODEL.md §2). Written against `app.services.budgets`
(docs/06_BACKEND.md §6), which is out of scope for this schema-only delivery —
see the note at the top of test_business_rules.py for why these are collected
and skipped rather than omitted.
"""

from datetime import date, timedelta
from decimal import Decimal

import pytest

budgets = pytest.importorskip(
    "app.services.budgets", reason="pending: app/services/budgets.py (docs/06_BACKEND.md §6)"
)
documents = pytest.importorskip(
    "app.services.documents", reason="pending: app/services/documents.py"
)


@pytest.fixture()
def confirmed_budget(db, analytic_accounts):
    from app.models import Budget, BudgetLine
    from app.models.enums import BudgetState

    budget = Budget(
        name="Q3 Budget",
        period_start=date(2026, 7, 1),
        period_end=date(2026, 9, 30),
        state=BudgetState.CONFIRMED,
    )
    db.add(budget)
    db.flush()
    db.add(
        BudgetLine(
            budget_id=budget.id,
            analytic_account_id=analytic_accounts["income"].id,
            committed_amount=Decimal("10000.00"),
        )
    )
    db.flush()
    return budget


def test_achieved_sums_only_documents_in_the_period(
    db, confirmed_budget, analytic_accounts, customer, product, today
):
    """A matching invoice one day after period_end must not count."""
    in_period = documents.create_invoice(
        db, customer=customer, invoice_date=date(2026, 8, 1), actor_id=None
    )
    documents.add_invoice_line(
        db,
        invoice_id=in_period.id,
        product_id=product.id,
        quantity=Decimal("1"),
        analytic_account_id=analytic_accounts["income"].id,
    )
    out_of_period = documents.create_invoice(
        db, customer=customer, invoice_date=confirmed_budget.period_end + timedelta(days=1), actor_id=None
    )
    documents.add_invoice_line(
        db,
        invoice_id=out_of_period.id,
        product_id=product.id,
        quantity=Decimal("1"),
        analytic_account_id=analytic_accounts["income"].id,
    )

    line = confirmed_budget.lines[0]
    assert budgets.achieved(db, line, confirmed_budget) == product.sales_price


def test_achieved_ignores_cancelled_documents(
    db, confirmed_budget, analytic_accounts, customer, product
):
    """Cancelling an invoice must reduce the achieved figure."""
    invoice = documents.create_invoice(
        db, customer=customer, invoice_date=date(2026, 8, 1), actor_id=None
    )
    documents.add_invoice_line(
        db,
        invoice_id=invoice.id,
        product_id=product.id,
        quantity=Decimal("1"),
        analytic_account_id=analytic_accounts["income"].id,
    )
    documents.cancel_invoice(db, invoice.id, actor_id=None)

    line = confirmed_budget.lines[0]
    assert budgets.achieved(db, line, confirmed_budget) == Decimal("0.00")


def test_income_analytics_read_invoices_and_expense_analytics_read_bills(
    db, confirmed_budget, analytic_accounts, customer, vendor, product
):
    """An expense analytic must not pick up an invoice carrying the same tag."""
    from app.models import Budget, BudgetLine
    from app.models.enums import BudgetState

    expense_budget = Budget(
        name="Q3 Expense Budget",
        period_start=confirmed_budget.period_start,
        period_end=confirmed_budget.period_end,
        state=BudgetState.CONFIRMED,
    )
    db.add(expense_budget)
    db.flush()
    expense_line = BudgetLine(
        budget_id=expense_budget.id,
        analytic_account_id=analytic_accounts["expense"].id,
        committed_amount=Decimal("5000.00"),
    )
    db.add(expense_line)
    db.flush()

    invoice = documents.create_invoice(
        db, customer=customer, invoice_date=date(2026, 8, 1), actor_id=None
    )
    documents.add_invoice_line(
        db,
        invoice_id=invoice.id,
        product_id=product.id,
        quantity=Decimal("1"),
        analytic_account_id=analytic_accounts["expense"].id,  # mismatched tag, deliberately
    )

    assert budgets.achieved(db, expense_line, expense_budget) == Decimal("0.00")


def test_revision_copies_lines_and_links_both_directions(db, confirmed_budget):
    successor = budgets.revise(db, confirmed_budget.id, actor_id=None)
    from app.models.enums import BudgetState

    assert confirmed_budget.state is BudgetState.REVISED
    assert confirmed_budget.revised_with_id == successor.id
    assert successor.revision_of_id == confirmed_budget.id
    assert successor.name.endswith(" Revised")
    assert len(successor.lines) == len(confirmed_budget.lines)


def test_zero_committed_does_not_divide_by_zero(db, analytic_accounts):
    from app.models import Budget, BudgetLine
    from app.models.enums import BudgetState

    budget = Budget(
        name="Zero budget",
        period_start=date(2026, 1, 1),
        period_end=date(2026, 3, 31),
        state=BudgetState.CONFIRMED,
    )
    db.add(budget)
    db.flush()
    line = BudgetLine(
        budget_id=budget.id,
        analytic_account_id=analytic_accounts["income"].id,
        committed_amount=Decimal("0.00"),
    )
    db.add(line)
    db.flush()

    assert budgets.achieved_pct(db, line, budget) == Decimal("0.00")
