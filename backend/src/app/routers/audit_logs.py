from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PageParams, page_params, paginate
from app.core.rbac import require_admin
from app.models.auth import User
from app.models.system import AuditLog
from app.schemas.common import ORMModel, Page

router = APIRouter(prefix="/audit-logs", tags=["audit"])


class AuditLogOut(ORMModel):
    id: str
    user_id: str
    action: str
    entity_name: str
    entity_id: str | None
    status_code: int
    created_at: object


@router.get("", response_model=Page[AuditLogOut])
def list_audit_logs(
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    """Who did what, when. Admin only — 04_API_CONTRACT.md §2."""
    return paginate(
        db,
        select(AuditLog),
        params,
        sortable={"created_at": AuditLog.created_at, "entity_name": AuditLog.entity_name},
        searchable=[AuditLog.action, AuditLog.entity_name],
        default_sort="-created_at",
    )
