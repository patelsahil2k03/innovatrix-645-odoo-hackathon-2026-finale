"""Audit trail response shapes (04_API_CONTRACT.md §2).

Lived inside `routers/audit_logs.py` until now — the only module that declared
its schema next to its route instead of here, which is also how `created_at`
came to be typed `object` and published itself to every client as an untyped
blob rather than a timestamp.
"""

from datetime import datetime

from pydantic import AliasPath, Field

from app.schemas.common import ORMModel


class AuditLogOut(ORMModel):
    id: str
    action: str
    entity_name: str
    entity_id: str | None
    status_code: int
    created_at: datetime

    # Flattened off the joined user rather than nested, because every consumer
    # wants the name beside the row and none of them wants a user object.
    user_id: str
    user_name: str | None = Field(default=None, validation_alias=AliasPath("user", "full_name"))
    user_email: str | None = Field(default=None, validation_alias=AliasPath("user", "email"))
