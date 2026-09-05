"""Report response shapes.

Every figure in this file is aggregated from `journal_lines` — never summed from
a document table (docs/06_BACKEND.md §8). The schemas are response-only; there is
nothing to write.
"""

from datetime import date

from pydantic import BaseModel

from app.models.masters import AccountType
from app.schemas.common import Money


class AccountBalanceRow(BaseModel):
    """One account's contribution to a report, already signed by normal balance."""

    account_id: str
    account_code: str
    account_name: str
    account_type: AccountType
    debit: Money
    credit: Money
    balance: Money


class ReportSection(BaseModel):
    """A group of accounts that share a heading, plus that heading's subtotal."""

    key: str
    label: str
    rows: list[AccountBalanceRow]
    total: Money


class BalanceSheetOut(BaseModel):
    as_of: date
    assets: list[ReportSection]
    liabilities: list[ReportSection]
    total_assets: Money
    total_liabilities: Money
    # The period's net profit, carried onto the balance sheet so that
    # assets == liabilities + capital + retained earnings actually holds.
    retained_earnings: Money
    total_liabilities_and_capital: Money
    is_balanced: bool


class ProfitAndLossOut(BaseModel):
    date_from: date
    date_to: date
    income: ReportSection
    expenses: ReportSection
    other_expenses: ReportSection
    total_income: Money
    total_expenses: Money
    net_profit: Money


class TrialBalanceRow(BaseModel):
    account_id: str
    account_code: str
    account_name: str
    debit: Money
    credit: Money


class TrialBalanceOut(BaseModel):
    """`is_balanced` drives the permanent `Trial balance 0.00` badge in the UI.

    It is computed from the rows below it on every request, never asserted —
    a badge that is hard-coded to true is worse than no badge at all.
    """

    as_of: date
    rows: list[TrialBalanceRow]
    total_debit: Money
    total_credit: Money
    difference: Money
    is_balanced: bool


class BudgetReportLine(BaseModel):
    analytic_account_id: str
    analytic_account: str
    type: str
    committed_amount: Money
    achieved_amount: Money
    achieved_pct: Money
    amount_to_achieve: Money


class BudgetReportOut(BaseModel):
    budget_id: str
    budget_name: str
    period_start: date
    period_end: date
    state: str
    lines: list[BudgetReportLine]
    total_committed: Money
    total_achieved: Money
    total_to_achieve: Money


class KpiOut(BaseModel):
    """The dashboard tiles. Every figure reads the ledger, like every report."""

    receivables: Money
    payables: Money
    cash: Money
    net_profit: Money
    is_balanced: bool
