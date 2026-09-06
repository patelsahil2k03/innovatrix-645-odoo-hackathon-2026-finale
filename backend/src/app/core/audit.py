"""Audit trail middleware: who changed what, when.

Records every write attempt by a signed-in user — POST/PATCH/PUT/DELETE —
whether the API accepted it or refused it.

Refusals used to be dropped, which removed exactly the rows an audit trail is
consulted for: an accountant who tried to archive a contact and was told no is
the event worth keeping, and a log that only holds successes cannot answer
"did anyone try". It also left the screen's outcome column unable to render
anything but "accepted".

Anonymous attempts are still skipped: with no valid token there is no "who",
and an audit row whose actor is unknown is a log line, not an audit record.
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
