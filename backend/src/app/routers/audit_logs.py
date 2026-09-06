"""Who did what, when — admin only (04_API_CONTRACT.md §2)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PageParams, page_params, paginate
from app.core.rbac import require_admin
from app.models.auth import User
from app.models.system import AuditLog
from app.schemas.audit import AuditLogOut
from app.schemas.common import Page

router = APIRouter(prefix="/audit-logs", tags=["audit"])

# The boundary the outcome filter splits on. Anything the API answered with a
# 4xx or 5xx was refused; everything else it carried out.
_REJECTED_FROM = 400


@router.get("", response_model=Page[AuditLogOut])
def list_audit_logs(
    entity_name: str | None = Query(None, description="Filter to one module."),
    outcome: str | None = Query(None, pattern="^(accepted|rejected)$"),
    user_id: str | None = Query(None, description="Filter to one actor."),
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    """Every write attempt, accepted or refused, newest first."""
    stmt = select(AuditLog)

    if entity_name:
        stmt = stmt.where(AuditLog.entity_name == entity_name)
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if outcome == "accepted":
        stmt = stmt.where(AuditLog.status_code < _REJECTED_FROM)
    elif outcome == "rejected":
        stmt = stmt.where(AuditLog.status_code >= _REJECTED_FROM)

    return paginate(
        db,
        stmt,
        params,
        sortable={
            "created_at": AuditLog.created_at,
            "entity_name": AuditLog.entity_name,
            "status_code": AuditLog.status_code,
        },
        searchable=[AuditLog.action, AuditLog.entity_name],
        default_sort="-created_at",
    )


@router.get("/entities", response_model=list[str])
def list_audited_entities(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[str]:
    """The modules that actually have audit rows.

    Backs the filter control: offering every module the app defines would list
    options that return nothing, and the useful question on this screen is
    "what has been touched", not "what could be".
    """
    rows = db.execute(
        select(AuditLog.entity_name).distinct().order_by(AuditLog.entity_name)
    ).scalars().all()
    return list(rows)
