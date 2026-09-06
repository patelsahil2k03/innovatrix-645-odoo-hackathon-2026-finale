from fastapi import APIRouter, Depends, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.errors import AppError
from app.core.rbac import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.core.settings import get_settings
from app.models.auth import Role, User
from app.schemas.auth import (
    LoginRequest,
    SignupRequest,
    TokenOut,
    UserOut,
    validate_password_strength,
)
from app.schemas.common import Message

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _authenticate(db: Session, email: str, password: str) -> User:
    user = db.execute(
        select(User).options(joinedload(User.role)).where(User.email == email.lower().strip())
    ).scalar_one_or_none()

    # Same error whether the email is unknown or the password is wrong — do not
    # let an attacker enumerate which accounts exist.
    if user is None or not verify_password(password, user.password_hash):
        raise AppError(
            "INVALID_CREDENTIALS",
            "That email and password combination is not correct.",
            status.HTTP_401_UNAUTHORIZED,
        )
    if not user.is_active:
        raise AppError(
            "ACCOUNT_INACTIVE", "This account has been deactivated.", status.HTTP_403_FORBIDDEN
        )
    return user


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> User:
    """Sets an httpOnly cookie. JavaScript can never read the token, so an XSS bug
    cannot steal the session."""
    user = _authenticate(db, payload.email, payload.password)
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=create_access_token(user_id=user.id, role=user.role.name),
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        max_age=settings.jwt_expires_minutes * 60,
        path="/",
    )
    return user


@router.post("/token", response_model=TokenOut, include_in_schema=True)
def token(
    form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
) -> TokenOut:
    """Bearer token for curl and the Swagger 'Authorize' button. Handy for demoing
    business-rule rejections live without opening the browser devtools."""
    user = _authenticate(db, form.username, form.password)
    return TokenOut(access_token=create_access_token(user_id=user.id, role=user.role.name))


@router.post("/logout", response_model=Message)
def logout(response: Response, _: User = Depends(get_current_user)) -> Message:
    response.delete_cookie(settings.auth_cookie_name, path="/")
    return Message(ok=True, message="Signed out.")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


SELF_SIGNUP_ROLE = "Accountant"
"""The mockup is explicit that signing up creates an invoicing user.

Admin and portal accounts are created by an Admin. If self-registration could
choose its own role, the entire Admin/Accountant permission split would be one
checkbox away from meaningless.
"""


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> User:
    """Self-registration (04_API_CONTRACT.md §3.0).

    Uniqueness is checked here and also enforced by unique indexes on both
    columns — the check gives a per-field message the form can display, and the
    index is what actually holds under two simultaneous signups.
    """
    login_id = payload.login_id.strip()
    email = payload.email.lower().strip()

    validate_password_strength(payload.password)

    taken = db.execute(select(User).where(User.login_id == login_id)).scalar_one_or_none()
    if taken is not None:
        raise AppError(
            "LOGIN_ID_TAKEN",
            "That login ID is already in use.",
            status.HTTP_409_CONFLICT,
            fields={"login_id": "Already taken — try another."},
        )

    taken = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if taken is not None:
        raise AppError(
            "EMAIL_TAKEN",
            "An account with that email already exists.",
            status.HTTP_409_CONFLICT,
            fields={"email": "Already registered — sign in instead."},
        )

    role = db.execute(
        select(Role).where(Role.name == SELF_SIGNUP_ROLE)
    ).scalar_one_or_none()
    if role is None:
        raise AppError(
            "ROLE_NOT_CONFIGURED",
            "Sign-up is unavailable because roles have not been seeded.",
        )

    user = User(
        email=email,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        login_id=login_id,
        role_id=role.id,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        # Lost the race against a simultaneous signup. The unique index caught
        # what the checks above could not see.
        db.rollback()
        raise AppError(
            "CONFLICT",
            "That login ID or email was just registered. Please try again.",
            status.HTTP_409_CONFLICT,
        ) from exc
    db.refresh(user)
    return user
