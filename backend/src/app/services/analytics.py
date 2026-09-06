"""Aggregations behind the analytics screen.

Same rule as `services/reports.py`: every money figure here aggregates
`journal_lines`. Nothing in this file sums a document table, because a document
still holds its original amount after being cancelled or reversed while the
ledger holds both the entry and the entry that undid it.

The one deliberate exception is `ageing()`, which reads customer invoices and
vendor bills directly — ageing is a question about *documents outstanding*
("what is still unpaid, and for how long"), not about ledger balances. The
receivable control account knows the total owed; it does not know which invoice
is 45 days late. That distinction is the reason the function exists here rather
than being derived from `1100 Debtors`.

No summary tables back any of this. Reports aggregate the ledger on demand —
storing a rolled-up figure anywhere is the one thing the whole design forbids
(brain/RULES.md §3), because a stored total is a second source of truth that
drifts. At this data volume the aggregate runs in single-digit milliseconds.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import Numeric, case, func, select
from sqlalchemy.orm import Session

from app.models.documents import (
    CustomerInvoice,
    CustomerInvoiceStatus,
    VendorBill,
    VendorBillStatus,
)
from app.models.ledger import JournalEntry, JournalLine
from app.models.masters import Account, AccountType, AnalyticAccount, Contact
from app.services.money import q2
from app.services.posting import LEDGER_STATES

logger = logging.getLogger(__name__)

ZERO = Decimal("0.00")

# Buckets the ageing report groups into. Upper bound is exclusive; the last
# bucket is open-ended. 30/60/90 is the convention every accountant reads
# without a legend.
AGEING_BUCKETS: tuple[tuple[str, int, int | None], ...] = (
    ("Current", 0, 1),
    ("1-30", 1, 31),
    ("31-60", 31, 61),
    ("61-90", 61, 91),
    ("90+", 91, None),
)


def _month_floor(value: date) -> date:
    return value.replace(day=1)


def _month_series(months: int, as_of: date) -> list[date]:
    """The last `months` month-start dates, oldest first, always contiguous.

    Built from the calendar rather than from what the ledger happens to contain:
    a month with no trade has to appear in the series as a zero, otherwise the
    chart silently closes the gap and a quiet month reads as though it never
    existed.
    """
    cursor = _month_floor(as_of)
    out = [cursor]
    for _ in range(months - 1):
        cursor = _month_floor(cursor - timedelta(days=1))
        out.append(cursor)
    return list(reversed(out))


def _signed_totals_by_month(
    db: Session, types: tuple[AccountType, ...], date_from: date, date_to: date
) -> dict[date, Decimal]:
    """Net movement per month for a set of account types.

    Income is credit-positive and expense debit-positive, so each is summed in
    the direction that makes it a positive number to a reader — a P&L that
    reports income as negative is technically defensible and useless on a chart.
    """
    credit_positive = AccountType.INCOME in types
    amount = (
        (JournalLine.credit - JournalLine.debit)
        if credit_positive
        else (JournalLine.debit - JournalLine.credit)
    )
    rows = db.execute(
        select(JournalEntry.entry_date, amount.label("amount"))
        .select_from(JournalLine)
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .join(Account, JournalLine.account_id == Account.id)
        .where(
            JournalEntry.state.in_(LEDGER_STATES),
            Account.type.in_(types),
            JournalEntry.entry_date >= date_from,
            JournalEntry.entry_date <= date_to,
        )
    ).all()

    # Bucketed in Python rather than with a SQL `date_trunc`/`strftime`, which
    # isn't the same function name across Postgres and SQLite (both are
    # supported backends — see .env.example) — see module docstring on why
    # summing at this volume is cheap enough to not need the DB to do it.
    totals: dict[date, Decimal] = {}
    for row in rows:
        month = _month_floor(row.entry_date)
        totals[month] = totals.get(month, ZERO) + Decimal(row.amount or 0)
    return totals


def trend(db: Session, *, months: int, as_of: date) -> dict:
    """Income, expense and net profit per month — the analytics hero series.

    Returns every month in the window including empty ones (see `_month_series`),
    so a line chart never draws a straight segment across a gap it should show
    as a dip to zero.
    """
    series = _month_series(months, as_of)
    date_from, date_to = series[0], as_of

    income = _signed_totals_by_month(db, (AccountType.INCOME,), date_from, date_to)
    expense = _signed_totals_by_month(
        db, (AccountType.EXPENSE, AccountType.OTHER_EXPENSE), date_from, date_to
    )

    points = []
    for month in series:
        got = q2(income.get(month, ZERO))
        spent = q2(expense.get(month, ZERO))
        points.append(
            {
                "month": month,
                "label": month.strftime("%b %Y"),
                "income": got,
                "expense": spent,
                "net_profit": q2(got - spent),
            }
        )

    return {
        "points": points,
        "total_income": q2(sum((p["income"] for p in points), ZERO)),
        "total_expense": q2(sum((p["expense"] for p in points), ZERO)),
        "total_net_profit": q2(sum((p["net_profit"] for p in points), ZERO)),
    }


def analytic_breakdown(db: Session, *, date_from: date, date_to: date) -> dict:
    """Posted value per analytic account — where the money actually went.

    Reads `journal_lines.analytic_account_id`, which the posting engine copies
    from the document line, so this stays consistent with every other ledger
    figure rather than re-deriving totals from the documents.
    """
    amount = func.sum(
        case(
            (Account.type == AccountType.INCOME, JournalLine.credit - JournalLine.debit),
            else_=JournalLine.debit - JournalLine.credit,
        )
    )
    rows = db.execute(
        select(
            AnalyticAccount.id,
            AnalyticAccount.name,
            AnalyticAccount.type,
            amount.label("amount"),
        )
        .select_from(JournalLine)
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .join(Account, JournalLine.account_id == Account.id)
        .join(AnalyticAccount, JournalLine.analytic_account_id == AnalyticAccount.id)
        .where(
            JournalEntry.state.in_(LEDGER_STATES),
            JournalEntry.entry_date >= date_from,
            JournalEntry.entry_date <= date_to,
        )
        .group_by(AnalyticAccount.id, AnalyticAccount.name, AnalyticAccount.type)
        .order_by(amount.desc())
    ).all()

    return {
        "slices": [
            {
                "id": row.id,
                "label": row.name,
                "type": row.type.value,
                "amount": q2(Decimal(row.amount or 0)),
            }
            for row in rows
        ]
    }


def top_contacts(db: Session, *, direction: str, limit: int, date_from: date,
                 date_to: date) -> dict:
    """Highest-value customers by revenue, or vendors by spend.

    Ranked off `journal_lines.partner_id`, which the posting engine stamps on
    every line, rather than off invoice totals — so a reversed invoice drops the
    contact back down the ranking instead of leaving them inflated forever.
    """
    if direction == "customer":
        types = (AccountType.INCOME,)
        amount = func.sum(JournalLine.credit - JournalLine.debit)
    else:
        types = (AccountType.EXPENSE, AccountType.OTHER_EXPENSE)
        amount = func.sum(JournalLine.debit - JournalLine.credit)

    rows = db.execute(
        select(Contact.id, Contact.name, amount.label("amount"))
        .select_from(JournalLine)
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .join(Account, JournalLine.account_id == Account.id)
        .join(Contact, JournalLine.partner_id == Contact.id)
        .where(
            JournalEntry.state.in_(LEDGER_STATES),
            Account.type.in_(types),
            JournalEntry.entry_date >= date_from,
            JournalEntry.entry_date <= date_to,
        )
        .group_by(Contact.id, Contact.name)
        .order_by(amount.desc())
        .limit(limit)
    ).all()

    return {
        "direction": direction,
        "rows": [
            {"id": row.id, "label": row.name, "amount": q2(Decimal(row.amount or 0))}
            for row in rows
            if Decimal(row.amount or 0) > ZERO
        ],
    }


def _ageing_for(db: Session, model, status_enum, as_of: date) -> list[dict]:
    """Outstanding balance per ageing bucket for one document type."""
    outstanding = (model.total - model.amount_paid).cast(Numeric(14, 2))

    buckets = {label: ZERO for label, _, _ in AGEING_BUCKETS}
    rows = db.execute(
        select(model.due_date, outstanding.label("outstanding"))
        .where(
            model.status.in_(
                [status_enum.POSTED, status_enum.PARTIAL]
            ),
            outstanding > 0,
        )
    ).all()

    for row in rows:
        # Not yet due is `Current`, exactly as this function's docstring says.
        # Without the clamp the day count goes negative, every bucket's `lower`
        # bound rejects it, and the document falls out of the report altogether
        # — so money that is genuinely owed simply stopped being counted, and
        # the buckets no longer summed to the outstanding balance.
        overdue = max(0, (as_of - row.due_date).days) if row.due_date else 0
        for label, lower, upper in AGEING_BUCKETS:
            if overdue < lower:
                continue
            if upper is None or overdue < upper:
                buckets[label] += Decimal(row.outstanding)
                break

    return [
        {"bucket": label, "amount": q2(buckets[label])}
        for label, _, _ in AGEING_BUCKETS
    ]


def ageing(db: Session, *, as_of: date) -> dict:
    """Receivables and payables split by how overdue they are.

    Deliberately reads documents rather than the ledger — see the module
    docstring. `Current` means not yet due, not "due today".
    """
    return {
        "as_of": as_of,
        "receivables": _ageing_for(db, CustomerInvoice, CustomerInvoiceStatus, as_of),
        "payables": _ageing_for(db, VendorBill, VendorBillStatus, as_of),
    }
