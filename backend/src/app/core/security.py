"""Password hashing, JWT issue/decode, and token extraction.

⚠️ WHY THIS FILE DOES NOT USE `passlib`
   passlib 1.7.4 was last released in 2020. It reads `bcrypt.__about__`, an attribute
   REMOVED in bcrypt 4.1+. Current bcrypt is 5.x, so `passlib[bcrypt]` fails with a
   confusing `AttributeError: module 'bcrypt' has no attribute '__about__'`.
   The previous project used passlib and would break today. We call bcrypt directly:
   two functions, no dead dependency, nothing to debug.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from fastapi import Request

from app.core.settings import get_settings

settings = get_settings()

# bcrypt hashes at most 72 bytes and raises on longer input. Truncate deliberately
# and visibly rather than letting a long passphrase blow up at signup.
_BCRYPT_MAX_BYTES = 72


def _to_bcrypt_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_to_bcrypt_bytes(password), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        # A malformed hash in the DB must read as "wrong password", not as a 500.
        return False


def create_access_token(*, user_id: str, role: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expires_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError:
        return None


def extract_token(request: Request) -> str | None:
    """Cookie first (browser), then Authorization: Bearer (curl / Swagger).

    Shared by both the RBAC dependency and the audit middleware. Last round these
    two implemented the same logic separately and could silently drift apart.
    """
    if cookie := request.cookies.get(settings.auth_cookie_name):
        return cookie
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header.removeprefix("Bearer ").strip() or None
    return None
