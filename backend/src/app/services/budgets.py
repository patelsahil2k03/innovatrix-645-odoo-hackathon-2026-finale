"""Budgets: computed achievement, and revision instead of editing.

Only `committed_amount` is stored. Achieved, achieved % and amount-to-achieve are
derived on every read (03_DATA_MODEL.md §2), so they cannot go stale the way a
cached figure does the moment someone posts an invoice.

The achievement figure reads **document lines**, not journal lines. That is the
specification's own wording — *"search Analytical in Sales Invoice ... consider
budget period and compute total"* — and it is why `analytic_account_id` sits on
invoice, bill and order lines rather than on the ledger. Tagging journal lines
would be defensible accounting and the wrong answer to what was asked.
"""

import logging
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.budgets import Budget, BudgetLine, BudgetState
from app.models.documents import (
    CustomerInvoice,
    CustomerInvoiceLine,
    CustomerInvoiceStatus,
    VendorBill,
    VendorBillLine,
    VendorBillStatus,
)
from app.models.masters import AnalyticAccount, AnalyticType
from app.services.money import q2
from app.services.rules import lock_row

logger = logging.getLogger(__name__)

ZERO = Decimal("0.00")


def achieved_amount(
    db: Session, *, analytic_account_id: str, analytic_type: AnalyticType,
    period_start, period_end,
) -> Decimal:
    """Sum the document lines carrying this analytic tag inside the period.

    An INCOME analytic is measured against customer invoices and an EXPENSE one
    against vendor bills — the two sides of the business are not interchangeable,
    and summing both into one figure would net a project's revenue against its
    costs and call the result "achieved".

    Cancelled documents are excluded: they represent activity that was undone,
    and counting them would let a budget be "achieved" by raising and voiding
    invoices. The untaxed figure is what counts, not the tax-inclusive total —
    tax collected on behalf of the government was never the project's money.
    """
    if analytic_type is AnalyticType.INCOME:
        Doc, Line = CustomerInvoice, CustomerInvoiceLine
        doc_date, excluded = CustomerInvoice.invoice_date, CustomerInvoiceStatus.CANCELLED
        join_on = Line.invoice_id == Doc.id
    else:
        Doc, Line = VendorBill, VendorBillLine
        doc_date, excluded = VendorBill.bill_date, VendorBillStatus.CANCELLED
        join_on = Line.bill_id == Doc.id

    total = db.execute(
        select(func.coalesce(func.sum(Line.quantity * Line.unit_price), 0))
        .select_from(Line)
        .join(Doc, join_on)
        .where(
            Line.analytic_account_id == analytic_account_id,
            Doc.status != excluded,
            doc_date >= period_start,
            doc_date <= period_end,
        )
    ).scalar_one()
    return q2(Decimal(total or 0))


def line_achievement(db: Session, budget: Budget, line: BudgetLine) -> dict:
    """The three computed columns for one budget line."""
    analytic = line.analytic_account
    achieved = achieved_amount(
        db,
        analytic_account_id=line.analytic_account_id,
        analytic_type=analytic.type,
        period_start=budget.period_start,
        period_end=budget.period_end,
    )
    committed = q2(Decimal(line.committed_amount))
    # A committed amount of zero yields 0%, not a ZeroDivisionError — a budget
    # line planned at nothing is unusual but entirely legal.
    pct = q2(achieved / committed * 100) if committed > ZERO else ZERO
    return {
        "achieved_amount": achieved,
        "achieved_pct": pct,
        "amount_to_achieve": q2(committed - achieved),
    }


def with_achievement(db: Session, budget: Budget) -> Budget:
    """Attach the computed figures onto each line for serialisation.

    Set as plain attributes on the ORM object rather than written to it: these
    are response-only fields with no column behind them, so nothing here is ever
    persisted.
    """
    for line in budget.lines:
        for key, value in line_achievement(db, budget, line).items():
            setattr(line, key, value)
    return budget


def _validate_lines(db: Session, lines_in) -> None:
    seen: set[str] = set()
    for payload in lines_in:
        if payload.analytic_account_id in seen:
            raise AppError(
                "VALIDATION_ERROR",
                "The same analytic account appears twice on this budget.",
                fields={"lines": "Each analytic account may appear only once."},
            )
        seen.add(payload.analytic_account_id)
        if db.get(AnalyticAccount, payload.analytic_account_id) is None:
            raise AppError(
                "NOT_FOUND", "That analytic account no longer exists.", 404,
                fields={"analytic_account_id": "Unknown analytic account."},
            )


def create_budget(db: Session, payload) -> Budget:
    _validate_lines(db, payload.lines)
    budget = Budget(
        name=payload.name,
        period_start=payload.period_start,
        period_end=payload.period_end,
        responsible_id=payload.responsible_id,
        state=BudgetState.DRAFT,
    )
    db.add(budget)
    db.flush()
    budget.lines = [
        BudgetLine(
            budget_id=budget.id,
            analytic_account_id=line.analytic_account_id,
            committed_amount=Decimal(line.committed_amount),
        )
        for line in payload.lines
    ]
    db.flush()
    return budget


def update_budget(db: Session, budget_id: str, payload) -> Budget:
    budget = lock_row(db, Budget, budget_id)
    if budget is None:
        raise AppError("NOT_FOUND", "That budget no longer exists.", 404)
    if budget.state is not BudgetState.DRAFT:
        raise AppError(
            "INVALID_STATUS_TRANSITION",
            f"This budget is {budget.state.value} — only a draft budget can be "
            "edited. Revise it instead.",
        )

    if payload.name is not None:
        budget.name = payload.name
    if payload.period_start is not None:
        budget.period_start = payload.period_start
    if payload.period_end is not None:
        budget.period_end = payload.period_end
    if payload.responsible_id is not None:
        budget.responsible_id = payload.responsible_id
    if budget.period_end <= budget.period_start:
        raise AppError(
            "BUDGET_PERIOD_INVALID",
            "The budget period must end after it starts.",
            fields={"period_end": "Must be after period_start."},
        )
    if payload.lines is not None:
        _validate_lines(db, payload.lines)
        budget.lines = [
            BudgetLine(
                budget_id=budget.id,
                analytic_account_id=line.analytic_account_id,
                committed_amount=Decimal(line.committed_amount),
            )
            for line in payload.lines
        ]
    db.flush()
    return budget


def confirm_budget(db: Session, budget_id: str) -> Budget:
    budget = lock_row(db, Budget, budget_id)
    if budget is None:
        raise AppError("NOT_FOUND", "That budget no longer exists.", 404)
    if budget.state is not BudgetState.DRAFT:
        raise AppError(
            "INVALID_STATUS_TRANSITION",
            f"This budget is {budget.state.value}, so it cannot be confirmed.",
        )
    budget.state = BudgetState.CONFIRMED
    db.flush()
    return budget


def revise_budget(db: Session, budget_id: str) -> Budget:
    """Revision is a create, never an edit (06_BACKEND.md §6).

    The original keeps its numbers exactly as they were confirmed and moves to
    REVISED; a successor carries its lines forward under the name plus
    " Revised". Both are linked in both directions so either can be opened from
    the other — the same immutability instinct as the ledger, applied to planning.
    """
    budget = lock_row(db, Budget, budget_id)
    if budget is None:
        raise AppError("NOT_FOUND", "That budget no longer exists.", 404)
    # Checked before the state guard, not after. Revising moves the original to
    # REVISED, so a second attempt would otherwise trip BUDGET_NOT_CONFIRMED and
    # report "this budget is not confirmed" about a budget whose real problem is
    # that it already has a successor — leaving ALREADY_REVISED unreachable and
    # the user misinformed. The more specific diagnosis goes first.
    if budget.revised_with_id is not None:
        raise AppError(
            "ALREADY_REVISED",
            "This budget has already been revised.",
            status_code=409,
        )
    if budget.state is not BudgetState.CONFIRMED:
        raise AppError(
            "BUDGET_NOT_CONFIRMED",
            f"Only a confirmed budget can be revised — this one is "
            f"{budget.state.value}.",
        )

    successor = Budget(
        name=f"{budget.name} Revised",
        period_start=budget.period_start,
        period_end=budget.period_end,
        responsible_id=budget.responsible_id,
        state=BudgetState.CONFIRMED,
        revision_of_id=budget.id,
    )
    db.add(successor)
    db.flush()
    successor.lines = [
        BudgetLine(
            budget_id=successor.id,
            analytic_account_id=line.analytic_account_id,
            committed_amount=line.committed_amount,
        )
        for line in budget.lines
    ]
    budget.state = BudgetState.REVISED
    budget.revised_with_id = successor.id
    db.flush()
    return successor


def cancel_budget(db: Session, budget_id: str) -> Budget:
    budget = lock_row(db, Budget, budget_id)
    if budget is None:
        raise AppError("NOT_FOUND", "That budget no longer exists.", 404)
    if budget.state is BudgetState.CANCELLED:
        raise AppError("INVALID_STATUS_TRANSITION", "This budget is already cancelled.")
    budget.state = BudgetState.CANCELLED
    db.flush()
    return budget


def line_documents(db: Session, budget: Budget, line: BudgetLine) -> list[dict]:
    """The invoices or bills behind one line's achieved figure.

    This is the budget report's drill-down: a number the user cannot trace is a
    number they have to take on faith.
    """
    analytic = line.analytic_account
    if analytic.type is AnalyticType.INCOME:
        Doc, Line = CustomerInvoice, CustomerInvoiceLine
        doc_date, excluded = CustomerInvoice.invoice_date, CustomerInvoiceStatus.CANCELLED
        join_on = Line.invoice_id == Doc.id
        partner = CustomerInvoice.customer_id
    else:
        Doc, Line = VendorBill, VendorBillLine
        doc_date, excluded = VendorBill.bill_date, VendorBillStatus.CANCELLED
        join_on = Line.bill_id == Doc.id
        partner = VendorBill.vendor_id

    rows = db.execute(
        select(
            Doc.id, Doc.number, doc_date, partner, Doc.status,
            func.sum(Line.quantity * Line.unit_price),
        )
        .select_from(Line)
        .join(Doc, join_on)
        .where(
            Line.analytic_account_id == line.analytic_account_id,
            Doc.status != excluded,
            doc_date >= budget.period_start,
            doc_date <= budget.period_end,
        )
        .group_by(Doc.id, Doc.number, doc_date, partner, Doc.status)
        .order_by(doc_date)
    ).all()

    return [
        {
            "document_type": (
                "customer_invoice" if analytic.type is AnalyticType.INCOME
                else "vendor_bill"
            ),
            "id": row[0],
            "number": row[1],
            "date": row[2],
            "contact_id": row[3],
            "status": row[4].value if hasattr(row[4], "value") else row[4],
            "amount": q2(Decimal(row[5] or 0)),
        }
        for row in rows
    ]
