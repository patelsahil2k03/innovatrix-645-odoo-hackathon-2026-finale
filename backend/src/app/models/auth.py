"""Users and roles.

Roles are seeded ROWS, not a Python enum — so the problem statement's role names
("Fleet Manager", "Approver", whatever) go in the seed script, and no code changes.
"""

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Role(UUIDMixin, Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))

    users: Mapped[list["User"]] = relationship(back_populates="role")

    def __repr__(self) -> str:
        return f"<Role {self.name}>"


class User(UUIDMixin, TimestampMixin, Base):
    """`login_id` and `contact_id` exist for the accounting domain's Sign Up page
    and portal (docs/03_DATA_MODEL.md §9) — self-registration always creates an
    Accountant with a login_id; `contact_id` is set only for portal users and is
    what scopes their queries to their own documents."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "login_id IS NULL OR (length(login_id) >= 6 AND length(login_id) <= 12)",
            name="ck_users_login_id_length",
        ),
    )

    # Plain String, not citext: keeps SQLite and PostgreSQL behaving identically.
    # Emails are lowercased on write instead (see seed.py / auth router).
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Nullable + unique, same reasoning as Contact.email — NULL is distinct from
    # NULL in a unique index, so seeded staff users need not have one.
    login_id: Mapped[str | None] = mapped_column(String(12), unique=True)
    contact_id: Mapped[str | None] = mapped_column(ForeignKey("contacts.id"), index=True)

    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"), nullable=False)
    role: Mapped[Role] = relationship(back_populates="users", lazy="joined")

    def __repr__(self) -> str:
        return f"<User {self.email}>"
