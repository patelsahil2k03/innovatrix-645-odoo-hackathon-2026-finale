"""Budgets (04_API_CONTRACT.md §3.6).

Every read runs the achievement computation, so the three derived columns are
measured at the moment they are asked for rather than cached and hoped about.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.core.pagination import PageParams, page_params, paginate
from app.core.rbac import require_internal, require_txn_write
from app.models.auth import User
from app.models.budgets import Budget, BudgetLine, BudgetState
from app.schemas.budgets import BudgetCreate, BudgetOut, BudgetUpdate
from app.schemas.common import Page
from app.services import budgets as svc
from app.services.rules import emit

router = APIRouter(prefix="/budgets", tags=["budgets"])


def _get_or_404(db: Session, budget_id: str) -> Budget:
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise AppError("NOT_FOUND", "That budget no longer exists.", 404)
    return budget


@router.get("", response_model=Page[BudgetOut])
def list_budgets(
    state: BudgetState | None = Query(None),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    stmt = select(Budget)
    if state is not None:
        stmt = stmt.where(Budget.state == state)
    page = paginate(
        db, stmt, params,
        sortable={
            "name": Budget.name,
            "period_start": Budget.period_start,
            "state": Budget.state,
        },
        searchable=[Budget.name],
        default_sort="-period_start",
    )
    # The list screen shows achievement per budget too, so the same computation
    # runs here — over one page of rows, never the whole table.
    page["items"] = [svc.with_achievement(db, budget) for budget in page["items"]]
    return page


@router.get("/{budget_id}", response_model=BudgetOut)
def get_budget(
    budget_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
):
    return svc.with_achievement(db, _get_or_404(db, budget_id))


@router.post("", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
def create_budget(
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    budget = svc.create_budget(db, payload)
    db.commit()
    db.refresh(budget)
    emit("budget.created", id=budget.id, name=budget.name)
    return svc.with_achievement(db, budget)


@router.patch("/{budget_id}", response_model=BudgetOut)
def update_budget(
    budget_id: str,
    payload: BudgetUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    """Draft budgets only. A confirmed budget is revised, never edited."""
    budget = svc.update_budget(db, budget_id, payload)
    db.commit()
    db.refresh(budget)
    return svc.with_achievement(db, budget)


@router.post("/{budget_id}/confirm", response_model=BudgetOut)
def confirm_budget(
    budget_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    budget = svc.confirm_budget(db, budget_id)
    db.commit()
    db.refresh(budget)
    emit("budget.confirmed", id=budget.id, name=budget.name)
    return svc.with_achievement(db, budget)


@router.post(
    "/{budget_id}/revise", response_model=BudgetOut, status_code=status.HTTP_201_CREATED
)
def revise_budget(
    budget_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    """Create the successor and return it — the original is left untouched and
    moved to REVISED, linked to its successor in both directions."""
    successor = svc.revise_budget(db, budget_id)
    db.commit()
    db.refresh(successor)
    emit("budget.revised", id=successor.id, revision_of=budget_id)
    return svc.with_achievement(db, successor)


@router.post("/{budget_id}/cancel", response_model=BudgetOut)
def cancel_budget(
    budget_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    budget = svc.cancel_budget(db, budget_id)
    db.commit()
    db.refresh(budget)
    emit("budget.cancelled", id=budget.id, name=budget.name)
    return svc.with_achievement(db, budget)


@router.get("/{budget_id}/lines/{line_id}/documents")
def budget_line_documents(
    budget_id: str,
    line_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> list[dict]:
    """The invoices or bills behind one line's achieved figure — the drill-down."""
    budget = _get_or_404(db, budget_id)
    line = db.get(BudgetLine, line_id)
    if line is None or line.budget_id != budget.id:
        raise AppError("NOT_FOUND", "That budget line no longer exists.", 404)
    return svc.line_documents(db, budget, line)
