from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.settings import get_settings

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict:
    """Unauthenticated liveness probe. First thing to curl when something is wrong."""
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        database = "unreachable"
    return {
        "status": "ok" if database == "ok" else "degraded",
        "database": database,
        "version": settings.app_version,
    }
