"""The ledger invariant suite — docs/07_TESTING_AND_REVIEW.md §1.1: "write these first."

These exercise `app.services.posting`, which is out of scope for this schema-only
delivery (see docs/06_BACKEND.md §2 for the exact `post_entry`/`reverse_entry`
contract this file is written against). Until that module exists, every test here
is collected and skipped with a clear reason instead of erroring out — remove the
`importorskip` guard's reason for skipping the moment posting.py lands, and these
run unchanged as the acceptance test for it.
"""

from decimal import Decimal

import pytest

posting = pytest.importorskip(
    "app.services.posting",
    reason="pending: app/services/posting.py (docs/06_BACKEND.md §2) — post_entry() not built yet",
)
reports = pytest.importorskip(
    "app.services.reports",
    reason="pending: app/services/reports.py (docs/06_BACKEND.md §8) — report aggregation not built yet",
)


def _line(account, debit=Decimal("0"), credit=Decimal("0"), label=""):
    return posting.LineDraft(account=account, debit=debit, credit=credit, label=label)


def test_every_posted_entry_balances(db, chart_of_accounts, journals, today):
    entry = posting.post_entry(
        db,
        journal=journals["sales"],
        entry_date=today,
        reference="manual test",
        source_type="manual",
        source_id=None,
        lines=[
            _line(chart_of_accounts["debtors"], debit=Decimal("100.00")),
            _line(chart_of_accounts["sales_income"], credit=Decimal("100.00")),
        ],
        actor_id=None,
    )
    assert sum(l.debit for l in entry.lines) == sum(l.credit for l in entry.lines)


def test_unbalanced_lines_are_rejected_before_anything_is_written(
    db, chart_of_accounts, journals, today
):
    from app.core.errors import AppError

    with pytest.raises(AppError) as exc:
        posting.post_entry(
            db,
            journal=journals["sales"],
            entry_date=today,
            reference="bad",
            source_type="manual",
            source_id=None,
            lines=[
                _line(chart_of_accounts["debtors"], debit=Decimal("100.00")),
                _line(chart_of_accounts["sales_income"], credit=Decimal("50.00")),
            ],
            actor_id=None,
        )
    assert exc.value.code == "UNBALANCED_ENTRY"


def test_trial_balance_is_always_zero(db, chart_of_accounts, journals, today):
    """The single most important test in this repository."""
    posting.post_entry(
        db,
        journal=journals["sales"],
        entry_date=today,
        reference="inv-1",
        source_type="customer_invoice",
        source_id="33333333-3333-3333-3333-333333333333",
        lines=[
            _line(chart_of_accounts["debtors"], debit=Decimal("1180.00")),
            _line(chart_of_accounts["sales_income"], credit=Decimal("1000.00")),
            _line(chart_of_accounts["output_tax"], credit=Decimal("180.00")),
        ],
        actor_id=None,
    )
    total_debit, total_credit = reports.trial_balance(db)
    assert total_debit == total_credit


def test_reversing_an_entry_keeps_the_trial_balance_at_zero(db, chart_of_accounts, journals, today):
    entry = posting.post_entry(
        db,
        journal=journals["sales"],
        entry_date=today,
        reference="inv-2",
        source_type="customer_invoice",
        source_id="44444444-4444-4444-4444-444444444444",
        lines=[
            _line(chart_of_accounts["debtors"], debit=Decimal("500.00")),
            _line(chart_of_accounts["sales_income"], credit=Decimal("500.00")),
        ],
        actor_id=None,
    )
    posting.reverse_entry(db, entry, actor_id=None, reason="test reversal")
    total_debit, total_credit = reports.trial_balance(db)
    assert total_debit == total_credit


def test_reports_never_read_document_tables(db, chart_of_accounts, journals, customer, today):
    """Guards the rule that makes this an accounting system, not an invoice list.

    A summed-documents implementation of profit_and_loss() passes every other test
    in this file and fails only this one — which is exactly why it exists.
    """
    documents = pytest.importorskip("app.services.documents")

    invoice = documents.create_invoice(
        db, customer=customer, lines=[...], invoice_date=today, actor_id=None
    )
    documents.confirm_and_post_invoice(db, invoice.id, actor_id=None)
    documents.cancel_invoice(db, invoice.id, actor_id=None)  # writes a reversing entry

    pnl = reports.profit_and_loss(db, period_start=today, period_end=today)
    assert pnl.income == Decimal("0.00")
