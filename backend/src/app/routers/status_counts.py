"""Per-module document counts by state.

One endpoint for every module rather than one endpoint each: every screen that
wants a count wants the whole set — the dashboard shows all five side by side,
and a list page showing its own row still costs the caller a single request it
already has cached.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import require_internal
from app.models.auth import User
from app.schemas.status_counts import StatusCountsOut
from app.services import status_counts as svc

router = APIRouter(prefix="/status-counts", tags=["reports"])


@router.get("", response_model=StatusCountsOut)
def status_counts(
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    """All / Draft / Confirmed and every other state, per module."""
    return {"modules": svc.status_counts(db)}
