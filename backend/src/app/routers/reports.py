"""Reports (04_API_CONTRACT.md §3.8) — all four, plus CSV export.

Every endpoint here is a pure read over `journal_lines`. None of them cache, and
none of them read a document table, so a report cannot disagree with the ledger
it claims to describe.
"""

from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.csv_export import csv_response
from app.core.database import get_db
from app.core.errors import AppError
from app.core.rbac import require_internal
from app.models.auth import User
from app.models.base import utc_now
from app.schemas.reports import (
    BalanceSheetOut,
    BudgetReportOut,
    KpiOut,
    ProfitAndLossOut,
    TrialBalanceOut,
)
from app.services import reports as svc

router = APIRouter(prefix="/reports", tags=["reports"])


def _today() -> date:
    return utc_now().date()


@router.get("/balance-sheet", response_model=BalanceSheetOut)
def balance_sheet(
    as_of: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    """Assets against liabilities, capital and retained earnings, as at a date."""
    return svc.balance_sheet(db, as_of or _today())


@router.get("/profit-and-loss", response_model=ProfitAndLossOut)
def profit_and_loss(
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    """Income less expenses over a period.

    Defaults to the current calendar year to date, so the endpoint answers
    something meaningful before the user has picked a range.
    """
    today = _today()
    return svc.profit_and_loss(
        db, date_from or date(today.year, 1, 1), date_to or today
    )


@router.get("/trial-balance", response_model=TrialBalanceOut)
def trial_balance(
    as_of: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    """Per-account debit and credit totals, and `is_balanced`.

    This drives the permanent `Trial balance 0.00` badge. `difference` is
    returned as well as the boolean, so a failure shows by how much rather than
    only that it happened.
    """
    return svc.trial_balance(db, as_of or _today())


@router.get("/budget", response_model=BudgetReportOut)
def budget_report(
    budget_id: str = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    return svc.budget_report(db, budget_id)


@router.get("/kpis", response_model=KpiOut)
def kpis(
    as_of: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    """The dashboard tiles, from the same ledger as every report."""
    return svc.kpis(db, as_of or _today())


# ── CSV export ────────────────────────────────────────────────────────────────

_EXPORTABLE = {"balance-sheet", "profit-and-loss", "trial-balance", "budget"}


@router.get("/{name}/export")
def export_report(
    name: str,
    as_of: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    budget_id: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> StreamingResponse:
    """Stream any report as CSV, using exactly the figures the JSON returns.

    Both come from the same service call, so an exported file and the screen it
    was exported from can never disagree.
    """
    if name not in _EXPORTABLE:
        raise AppError(
            "NOT_FOUND",
            f"There is no report called {name!r}. Try one of: "
            f"{', '.join(sorted(_EXPORTABLE))}.",
            status_code=404,
        )

    today = _today()

    if name == "trial-balance":
        report = svc.trial_balance(db, as_of or today)
        return csv_response(
            f"trial-balance-{report['as_of']}.csv",
            ["Account code", "Account name", "Debit", "Credit"],
            [
                [r["account_code"], r["account_name"], r["debit"], r["credit"]]
                for r in report["rows"]
            ]
            + [
                [],
                ["", "Total", report["total_debit"], report["total_credit"]],
                ["", "Difference", report["difference"], ""],
            ],
        )

    if name == "balance-sheet":
        report = svc.balance_sheet(db, as_of or today)
        rows: list[list] = []
        for heading, sections in (
            ("ASSETS", report["assets"]),
            ("LIABILITIES & CAPITAL", report["liabilities"]),
        ):
            rows.append([heading, "", "", ""])
            for section in sections:
                rows.append([section["label"], "", "", section["total"]])
                for r in section["rows"]:
                    rows.append(
                        ["", r["account_code"], r["account_name"], r["balance"]]
                    )
        rows += [
            [],
            ["Total assets", "", "", report["total_assets"]],
            ["Retained earnings", "", "", report["retained_earnings"]],
            [
                "Total liabilities & capital", "", "",
                report["total_liabilities_and_capital"],
            ],
        ]
        return csv_response(
            f"balance-sheet-{report['as_of']}.csv",
            ["Section", "Code", "Account", "Amount"],
            rows,
        )

    if name == "profit-and-loss":
        report = svc.profit_and_loss(
            db, date_from or date(today.year, 1, 1), date_to or today
        )
        rows = []
        for section in (
            report["income"], report["expenses"], report["other_expenses"]
        ):
            rows.append([section["label"], "", section["total"]])
            for r in section["rows"]:
                rows.append([r["account_code"], r["account_name"], r["balance"]])
        rows += [
            [],
            ["Total income", "", report["total_income"]],
            ["Total expenses", "", report["total_expenses"]],
            ["Net profit", "", report["net_profit"]],
        ]
        return csv_response(
            f"profit-and-loss-{report['date_from']}-to-{report['date_to']}.csv",
            ["Code / Section", "Account", "Amount"],
            rows,
        )

    if budget_id is None:
        raise AppError(
            "VALIDATION_ERROR",
            "A budget_id is required to export the budget report.",
            fields={"budget_id": "This query parameter is required."},
        )
    report = svc.budget_report(db, budget_id)
    return csv_response(
        f"budget-{report['budget_name']}.csv".replace(" ", "-"),
        ["Analytic account", "Type", "Committed", "Achieved", "Achieved %", "To achieve"],
        [
            [
                line["analytic_account"], line["type"], line["committed_amount"],
                line["achieved_amount"], line["achieved_pct"], line["amount_to_achieve"],
            ]
            for line in report["lines"]
        ]
        + [
            [],
            [
                "Total", "", report["total_committed"], report["total_achieved"], "",
                report["total_to_achieve"],
            ],
        ],
    )
