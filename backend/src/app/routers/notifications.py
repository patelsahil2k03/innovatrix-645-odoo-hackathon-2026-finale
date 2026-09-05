from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PageParams, page_params, paginate
from app.core.rbac import get_current_user
from app.models.auth import User
from app.models.system import Notification
from app.schemas.common import ORMModel, Page

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(ORMModel):
    id: str
    title: str
    message: str
    is_read: bool
    created_at: object


@router.get("", response_model=Page[NotificationOut])
def list_notifications(
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Scoped to the calling user — one user can never read another's notifications."""
    stmt = select(Notification).where(Notification.user_id == user.id)
    return paginate(
        db,
        stmt,
        params,
        sortable={"created_at": Notification.created_at, "title": Notification.title},
        searchable=[Notification.title, Notification.message],
        default_sort="-created_at",
    )


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> dict:
    result = db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.commit()
    return {"marked_read": result.rowcount or 0}
