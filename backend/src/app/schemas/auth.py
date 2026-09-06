from pydantic import BaseModel, EmailStr, Field

from app.core.errors import AppError
from app.schemas.common import ORMModel


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RoleOut(ORMModel):
    id: str
    name: str
    description: str | None = None


class UserOut(ORMModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    role: RoleOut


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Sign up (docs/04_API_CONTRACT.md §3.0) ────────────────────────────────────

LOGIN_ID_MIN, LOGIN_ID_MAX = 6, 12
SPECIAL_CHARACTERS = set(r"""!@#$%^&*()-_=+[]{};:'",.<>/?\|`~""")


class SignupRequest(BaseModel):
    """Self-registration. Always creates an Accountant — Admin and portal
    accounts are created by an Admin, never by signing up."""

    login_id: str = Field(min_length=LOGIN_ID_MIN, max_length=LOGIN_ID_MAX)
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=128)


def validate_password_strength(password: str) -> None:
    """The mockup's rules, verbatim: longer than 8 characters, and containing a
    lowercase letter, an uppercase letter and a special character.

    Raised as one `WEAK_PASSWORD` carrying a single `password` field message
    rather than as a pydantic constraint, because the frontend shows these as a
    checklist under one input — `validation.ts` mirrors the same four rules, and
    the two layers must agree exactly.

    Note "longer than 8", not "at least 8": an 8-character password is rejected.
    """
    problems: list[str] = []
    if len(password) <= 8:
        problems.append("be longer than 8 characters")
    if not any(c.islower() for c in password):
        problems.append("contain a lowercase letter")
    if not any(c.isupper() for c in password):
        problems.append("contain an uppercase letter")
    if not any(c in SPECIAL_CHARACTERS for c in password):
        problems.append("contain a special character")

    if problems:
        raise AppError(
            "WEAK_PASSWORD",
            "That password does not meet the requirements.",
            fields={"password": "Password must " + ", ".join(problems) + "."},
        )
