from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PageParams, page_params, paginate
from app.core.rbac import get_current_user
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
    _: User = Depends(get_current_user),
) -> dict:
    """Who did what, when.

    ★ Gate this to your admin-equivalent role once the PS names its roles:
        _: User = Depends(require_roles("Administrator"))
    """
    return paginate(
        db,
        select(AuditLog),
        params,
        sortable={"created_at": AuditLog.created_at, "entity_name": AuditLog.entity_name},
        searchable=[AuditLog.action, AuditLog.entity_name],
        default_sort="-created_at",
    )
