"""The reports. Every figure aggregates `journal_lines` and nothing else.

`SELECT SUM(total) FROM customer_invoices` is faster to write, looks correct in a
demo, and is silently wrong the moment anything is cancelled or reversed — the
document table still holds the original amount while the ledger holds both the
entry and its reversal. If a report in this file ever reads a document table,
that is a bug, not a shortcut (06_BACKEND.md §8).

The one exception is the budget report, which reads document lines by design —
the analytic dimension lives there, not on the ledger. See `services/budgets.py`
for why that is the specification's answer rather than ours.
"""

import logging
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.budgets import Budget
from app.models.ledger import JournalEntry, JournalLine
from app.models.masters import DEBIT_POSITIVE_TYPES, Account, AccountType
from app.services.budgets import line_achievement
from app.services.money import q2
from app.services.posting import LEDGER_STATES

logger = logging.getLogger(__name__)

ZERO = Decimal("0.00")

BALANCE_SHEET_ASSET_TYPES = (AccountType.ASSET, AccountType.BANK, AccountType.CASH)
BALANCE_SHEET_LIABILITY_TYPES = (AccountType.LIABILITY, AccountType.CAPITAL)
PROFIT_AND_LOSS_TYPES = (
    AccountType.INCOME,
    AccountType.EXPENSE,
    AccountType.OTHER_EXPENSE,
)

SECTION_LABELS = {
    AccountType.ASSET: "Assets",
    AccountType.BANK: "Bank",
    AccountType.CASH: "Cash",
    AccountType.LIABILITY: "Liabilities",
    AccountType.CAPITAL: "Capital",
    AccountType.INCOME: "Income",
    AccountType.EXPENSE: "Expenses",
    AccountType.OTHER_EXPENSE: "Other Expenses",
}


def _account_totals(
    db: Session,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    types: tuple[AccountType, ...] | None = None,
) -> list[tuple]:
    """Debit and credit per account over a date window.

    `LEDGER_STATES` rather than `state == POSTED`: a reversed entry still counts,
    and is cancelled by its reversal rather than by being filtered away. See the
    constant's docstring in services/posting.py — filtering on POSTED alone
    leaves every reversed transaction showing as its own negative.
    """
    stmt = (
        select(
            Account.id,
            Account.code,
            Account.name,
            Account.type,
            func.coalesce(func.sum(JournalLine.debit), 0),
            func.coalesce(func.sum(JournalLine.credit), 0),
        )
        .select_from(JournalLine)
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .join(Account, JournalLine.account_id == Account.id)
        .where(JournalEntry.state.in_(LEDGER_STATES))
        .group_by(Account.id, Account.code, Account.name, Account.type)
        .order_by(Account.code)
    )
    if date_from is not None:
        stmt = stmt.where(JournalEntry.entry_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(JournalEntry.entry_date <= date_to)
    if types is not None:
        stmt = stmt.where(Account.type.in_(types))
    return db.execute(stmt).all()


def _row(account_id, code, name, account_type, debit, credit) -> dict:
    """Sign one account's balance by its normal balance.

    Derived from the account's type, never stored (03_DATA_MODEL.md §2): an asset
    or expense is debit-positive, a liability, capital or income is
    credit-positive. Presenting a raw `debit - credit` for every account would
    show income and liabilities as negative numbers, which is arithmetically
    fine and reads as broken.
    """
    debit, credit = q2(Decimal(debit)), q2(Decimal(credit))
    balance = (
        debit - credit if account_type in DEBIT_POSITIVE_TYPES else credit - debit
    )
    return {
        "account_id": account_id,
        "account_code": code,
        "account_name": name,
        "account_type": account_type,
        "debit": debit,
        "credit": credit,
        "balance": q2(balance),
    }


def _sections(rows: list[dict], types: tuple[AccountType, ...]) -> list[dict]:
    """Group signed rows under one heading per account type, in the given order."""
    out = []
    for account_type in types:
        group = [r for r in rows if r["account_type"] is account_type]
        out.append(
            {
                "key": account_type.value,
                "label": SECTION_LABELS[account_type],
                "rows": group,
                "total": q2(sum((r["balance"] for r in group), ZERO)),
            }
        )
    return out


def profit_and_loss(db: Session, date_from: date, date_to: date) -> dict:
    """Income less expenses for the period.

    `EXPENSE` and `OTHER_EXPENSE` are reported on separate lines because the
    mockup's P&L does — that separation is the whole reason `OTHER_EXPENSE`
    exists as its own account type rather than as a name under `EXPENSE`.
    """
    if date_to < date_from:
        raise AppError(
            "VALIDATION_ERROR", "The end of the period must not precede its start.",
            fields={"date_to": "Must be on or after date_from."},
        )

    rows = [
        _row(*r)
        for r in _account_totals(
            db, date_from=date_from, date_to=date_to, types=PROFIT_AND_LOSS_TYPES
        )
    ]
    income, expenses, other = _sections(rows, PROFIT_AND_LOSS_TYPES)

    total_income = income["total"]
    total_expenses = q2(expenses["total"] + other["total"])
    return {
        "date_from": date_from,
        "date_to": date_to,
        "income": income,
        "expenses": expenses,
        "other_expenses": other,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_profit": q2(total_income - total_expenses),
    }


def net_profit_to_date(db: Session, as_of: date) -> Decimal:
    """Cumulative profit up to `as_of` — the balance sheet's retained earnings.

    Without this the balance sheet cannot balance: every sale credits income and
    debits an asset, and income is a P&L account that never appears among assets
    or liabilities. Carrying the net figure across as retained earnings is what
    closes the loop, and is why `total_liabilities_and_capital` includes it.
    """
    rows = [
        _row(*r) for r in _account_totals(db, date_to=as_of, types=PROFIT_AND_LOSS_TYPES)
    ]
    income = sum(
        (r["balance"] for r in rows if r["account_type"] is AccountType.INCOME), ZERO
    )
    expenses = sum(
        (
            r["balance"]
            for r in rows
            if r["account_type"] in (AccountType.EXPENSE, AccountType.OTHER_EXPENSE)
        ),
        ZERO,
    )
    return q2(income - expenses)


def balance_sheet(db: Session, as_of: date) -> dict:
    """Assets against liabilities, capital and retained earnings, as at a date."""
    rows = [
        _row(*r)
        for r in _account_totals(
            db,
            date_to=as_of,
            types=BALANCE_SHEET_ASSET_TYPES + BALANCE_SHEET_LIABILITY_TYPES,
        )
    ]
    assets = _sections(rows, BALANCE_SHEET_ASSET_TYPES)
    liabilities = _sections(rows, BALANCE_SHEET_LIABILITY_TYPES)

    total_assets = q2(sum((s["total"] for s in assets), ZERO))
    total_liabilities = q2(sum((s["total"] for s in liabilities), ZERO))
    retained = net_profit_to_date(db, as_of)
    total_l_and_c = q2(total_liabilities + retained)

    return {
        "as_of": as_of,
        "assets": assets,
        "liabilities": liabilities,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "retained_earnings": retained,
        "total_liabilities_and_capital": total_l_and_c,
        # Computed, never asserted — if this is ever False the ledger is telling
        # the truth about a real problem, and the UI should say so.
        "is_balanced": total_assets == total_l_and_c,
    }


def trial_balance(db: Session, as_of: date) -> dict:
    """Every account's raw debit and credit totals, and whether they agree.

    Unsigned on purpose: a trial balance is the one report that shows the ledger
    exactly as stored, because its entire job is to prove that the stored form is
    self-consistent. Signing the rows first would hide the very thing it checks.
    """
    rows = [
        {
            "account_id": r[0],
            "account_code": r[1],
            "account_name": r[2],
            "debit": q2(Decimal(r[4])),
            "credit": q2(Decimal(r[5])),
        }
        for r in _account_totals(db, date_to=as_of)
    ]
    total_debit = q2(sum((r["debit"] for r in rows), ZERO))
    total_credit = q2(sum((r["credit"] for r in rows), ZERO))
    difference = q2(total_debit - total_credit)

    return {
        "as_of": as_of,
        "rows": rows,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "difference": difference,
        "is_balanced": difference == ZERO,
    }


def budget_report(db: Session, budget_id: str) -> dict:
    """Planned against achieved, per analytic account (04_API_CONTRACT.md §3.8)."""
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise AppError("NOT_FOUND", "That budget no longer exists.", 404)

    lines = []
    for line in budget.lines:
        computed = line_achievement(db, budget, line)
        lines.append(
            {
                "analytic_account_id": line.analytic_account_id,
                "analytic_account": line.analytic_account.name,
                "type": line.analytic_account.type.value,
                "committed_amount": q2(Decimal(line.committed_amount)),
                **computed,
            }
        )

    return {
        "budget_id": budget.id,
        "budget_name": budget.name,
        "period_start": budget.period_start,
        "period_end": budget.period_end,
        "state": budget.state.value,
        "lines": lines,
        "total_committed": q2(sum((line["committed_amount"] for line in lines), ZERO)),
        "total_achieved": q2(sum((line["achieved_amount"] for line in lines), ZERO)),
        "total_to_achieve": q2(sum((line["amount_to_achieve"] for line in lines), ZERO)),
    }


def kpis(db: Session, as_of: date) -> dict:
    """The dashboard tiles — the same ledger, aggregated four more ways."""
    rows = [_row(*r) for r in _account_totals(db, date_to=as_of)]

    def total_for(*types: AccountType) -> Decimal:
        return q2(sum((r["balance"] for r in rows if r["account_type"] in types), ZERO))

    balance = trial_balance(db, as_of)
    return {
        # Receivables and payables are the ASSET and LIABILITY balances the
        # contacts' own accounts carry — not a count of unpaid documents, which
        # would drift from the ledger the moment a payment posted.
        "receivables": total_for(AccountType.ASSET),
        "payables": total_for(AccountType.LIABILITY),
        "cash": total_for(AccountType.BANK, AccountType.CASH),
        "net_profit": net_profit_to_date(db, as_of),
        "is_balanced": balance["is_balanced"],
    }
