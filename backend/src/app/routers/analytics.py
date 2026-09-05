"""Analytics (the charts screen).

Four aggregations over the same ledger the reports read. Kept in their own router
rather than bolted onto `reports.py` because they answer a different question:
the reports are statutory documents with a fixed shape, these are exploratory
series a user reshapes on screen.

Every parameter is validated and bounded. An unbounded `months` or `limit` here
would let a caller ask for a query the database has to walk the whole ledger for.
"""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import require_internal
from app.models.auth import User
from app.models.base import utc_now
from app.schemas.analytics import AgeingOut, BreakdownOut, TopContactsOut, TrendOut
from app.services import analytics as svc

router = APIRouter(prefix="/analytics", tags=["analytics"])

# A year of history is what the seeded data covers and what the screen defaults
# to. 36 is a generous ceiling that still bounds the query.
DEFAULT_MONTHS = 12
MAX_MONTHS = 36


def _today() -> date:
    return utc_now().date()


@router.get("/trend", response_model=TrendOut)
def trend(
    months: int = Query(DEFAULT_MONTHS, ge=1, le=MAX_MONTHS),
    as_of: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
):
    """Income, expense and net profit per month.

    Interchangeable as a line, area or bar on the client — it is one series over
    time, so all three encodings say the same true thing.
    """
    return svc.trend(db, months=months, as_of=as_of or _today())


@router.get("/breakdown", response_model=BreakdownOut)
def breakdown(
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
):
    """Posted value per analytic account — a composition, not a time series."""
    end = date_to or _today()
    start = date_from or end.replace(year=end.year - 1)
    return svc.analytic_breakdown(db, date_from=start, date_to=end)


@router.get("/top-contacts", response_model=TopContactsOut)
def top_contacts(
    direction: str = Query("customer", pattern="^(customer|vendor)$"),
    limit: int = Query(8, ge=1, le=25),
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
):
    """Top customers by revenue, or top vendors by spend."""
    end = date_to or _today()
    start = date_from or end.replace(year=end.year - 1)
    return svc.top_contacts(
        db, direction=direction, limit=limit, date_from=start, date_to=end
    )


@router.get("/ageing", response_model=AgeingOut)
def ageing(
    as_of: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
):
    """Receivables and payables by how overdue they are."""
    return svc.ageing(db, as_of=as_of or _today())
