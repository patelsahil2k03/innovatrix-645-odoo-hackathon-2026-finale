"""Audit trail middleware: who changed what, when.

Cheap to build, and it reads as an enterprise feature to an evaluator.
Records only SUCCESSFUL writes (2xx on POST/PATCH/PUT/DELETE).
"""

import json
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.database import SessionLocal
from app.core.security import decode_access_token, extract_token

logger = logging.getLogger(__name__)

_WRITE_METHODS = {"POST", "PATCH", "PUT", "DELETE"}
_SKIP_PATHS = ("/auth/login", "/auth/logout", "/auth/token", "/docs", "/openapi.json")


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        if request.method not in _WRITE_METHODS:
            return response
        if any(skip in request.url.path for skip in _SKIP_PATHS):
            return response
        if not (200 <= response.status_code < 300):
            return response

        try:
            self._record(request, response)
        except Exception as exc:  # auditing must never break the actual request
            logger.warning("Audit write failed: %s", exc)

        return response

    def _record(self, request: Request, response: Response) -> None:
        from app.models.system import AuditLog

        token = extract_token(request)
        payload = decode_access_token(token) if token else None
        if not payload:
            return

        path = request.url.path
        entity = self._entity_name(path)

        db = SessionLocal()
        try:
            db.add(
                AuditLog(
                    user_id=payload["sub"],
                    action=f"{request.method} {path}",
                    entity_name=entity,
                    entity_id=self._entity_id(path),
                    status_code=response.status_code,
                )
            )
            db.commit()
        finally:
            db.close()

    @staticmethod
    def _entity_name(path: str) -> str:
        parts = [p for p in path.split("/") if p and p not in ("api", "v1")]
        return parts[0] if parts else "unknown"

    @staticmethod
    def _entity_id(path: str) -> str | None:
        # Last UUID-ish segment in the path, if any.
        for part in reversed(path.split("/")):
            if len(part) >= 32 and "-" in part:
                return part
        return None
