"""Deterministic demo seed.

    uv run python -m app.seed              # seed (skips if data already exists)
    uv run python -m app.seed --reset      # ⚠️ DESTRUCTIVE: wipes tables, then seeds
    uv run python -m app.seed --yes        # skip the confirmation prompt

⚠️ DESTRUCTIVE-REBUILD WARNING
   `--reset` deletes every row in the tables it manages. It prompts before doing so.
   Do NOT wire `--reset` into any script that runs automatically. During the previous
   hackathon's post-mortem this class of file was flagged as a "live landmine": a
   normal-looking re-run that silently destroys hours of work. The prompt below is
   deliberate — the person about to lose data is looking at the terminal, not the docs.
"""

import argparse
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.core.security import hash_password
from app.core.settings import get_settings
from app.models import Base
from app.models.auth import Role, User
from app.models.budgets import Budget, BudgetLine
from app.models.documents import (
    CustomerInvoice,
    CustomerInvoiceLine,
    PurchaseOrder,
    PurchaseOrderLine,
    SalesOrder,
    SalesOrderLine,
    VendorBill,
    VendorBillLine,
)
from app.models.ledger import JournalEntry, JournalLine, NumberSequence
from app.models.masters import (
    Account,
    AccountType,
    AnalyticAccount,
    Contact,
    Journal,
    JournalType,
    Product,
    ProductCategory,
)
from app.models.payments import Payment
from app.models.system import Notification
from app.seed.domain import seed_domain
from app.seed.generators import Gen

settings = get_settings()

# The three roles from docs/PROBLEM_STATEMENT.md §2 — Admin/Accountant split is a
# tested rule (Accountant creates master data but cannot modify or archive it);
# User is the contact-portal role and always carries a contact_id once one exists.
ROLES: list[tuple[str, str]] = [
    ("Admin", "Full access — creates, modifies and archives master data, all reports"),
    ("Accountant", "Creates master data and records transactions — cannot modify or archive"),
    ("User", "Contact portal — sees and pays only their own invoices and bills"),
]

DEMO_USERS: list[tuple[str, str, str, str]] = [
    # email, full name, role, login_id
    ("admin@urbanfurniture.in", "Aarav Sharma", "Admin", "admin01"),
    ("accountant@urbanfurniture.in", "Meera Nair", "Accountant", "meera01"),
]

# The Chart of Accounts (docs/03_DATA_MODEL.md §8). The mockup itself says these
# are "to be pre configured" — not invented by a user on the fly — so they are
# seeded once here rather than left as an empty list for the team to populate by
# hand. Nothing can post without these existing.
CHART_OF_ACCOUNTS: list[tuple[str, str, AccountType]] = [
    ("1000", "Cash", AccountType.CASH),
    ("1010", "Bank", AccountType.BANK),
    ("1100", "Debtors", AccountType.ASSET),
    ("1200", "Input Tax", AccountType.ASSET),
    ("2000", "Creditors", AccountType.LIABILITY),
    ("2100", "Output Tax", AccountType.LIABILITY),
    ("3000", "Capital", AccountType.CAPITAL),
    ("4000", "Sales Income", AccountType.INCOME),
    ("5000", "Purchase Expense", AccountType.EXPENSE),
    ("5100", "Other Expense", AccountType.OTHER_EXPENSE),
]

# One journal per money-movement type. Bank/Cash journals default to the account
# of the same name — that IS the money account for those two (docs/03_DATA_MODEL.md
# §2). Sales/Purchase journals don't default an account: the actual debit/credit
# accounts come from the contact and product on each document, not from the journal.
JOURNALS: list[tuple[str, JournalType, str | None, str | None]] = [
    ("Sales", JournalType.SALES, None, None),
    ("Purchase", JournalType.PURCHASE, None, None),
    ("Bank", JournalType.BANK, "1010", "1010"),
    ("Cash", JournalType.CASH, "1000", "1000"),
]


def create_tables() -> None:
    """Convenience for a fresh SQLite file. Alembic remains the source of truth
    for schema changes — this just means `--reset` works on an empty database."""
    Base.metadata.create_all(bind=engine)


def reset_tables(db: Session) -> None:
    """Delete all rows, children first so foreign keys stay satisfied.

    Order matters and is not alphabetical: payments and documents reference
    journal entries, entries reference journals and accounts, and everything
    references contacts. Deleting a parent first fails on the foreign keys that
    `PRAGMA foreign_keys=ON` (core/database.py) deliberately enforces.
    """
    for model in (
        Payment,
        JournalLine,
        CustomerInvoiceLine,
        VendorBillLine,
        SalesOrderLine,
        PurchaseOrderLine,
        CustomerInvoice,
        VendorBill,
        SalesOrder,
        PurchaseOrder,
        JournalEntry,
        BudgetLine,
        Budget,
        NumberSequence,
        Notification,
        User,
        Role,
        Journal,
        Product,
        ProductCategory,
        AnalyticAccount,
        Contact,
        Account,
    ):
        db.query(model).delete()
    db.commit()


def seed_roles(db: Session) -> dict[str, Role]:
    roles: dict[str, Role] = {}
    for name, description in ROLES:
        role = db.execute(select(Role).where(Role.name == name)).scalar_one_or_none()
        if role is None:
            role = Role(name=name, description=description)
            db.add(role)
        roles[name] = role
    db.commit()
    return roles


def seed_users(db: Session, roles: dict[str, Role]) -> list[User]:
    created: list[User] = []
    password_hash = hash_password(settings.seed_password)

    for email, full_name, role_name, login_id in DEMO_USERS:
        existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if existing is not None:
            created.append(existing)
            continue
        user = User(
            email=email.lower(),
            full_name=full_name,
            password_hash=password_hash,
            role_id=roles[role_name].id,
            login_id=login_id,
        )
        db.add(user)
        created.append(user)

    db.commit()
    return created


def seed_chart_of_accounts(db: Session) -> dict[str, Account]:
    """The eight accounts every posting depends on (docs/03_DATA_MODEL.md §8)."""
    accounts: dict[str, Account] = {}
    for code, name, account_type in CHART_OF_ACCOUNTS:
        account = db.execute(select(Account).where(Account.code == code)).scalar_one_or_none()
        if account is None:
            account = Account(code=code, name=name, type=account_type)
            db.add(account)
        accounts[code] = account
    db.commit()
    return accounts


def seed_journals(db: Session, accounts: dict[str, Account]) -> dict[str, Journal]:
    journals: dict[str, Journal] = {}
    for name, journal_type, debit_code, credit_code in JOURNALS:
        journal = db.execute(select(Journal).where(Journal.name == name)).scalar_one_or_none()
        if journal is None:
            journal = Journal(
                name=name,
                type=journal_type,
                default_debit_account_id=accounts[debit_code].id if debit_code else None,
                default_credit_account_id=accounts[credit_code].id if credit_code else None,
            )
            db.add(journal)
        journals[name] = journal
    db.commit()
    return journals


def seed_notifications(db: Session, users: list[User], gen: Gen) -> int:
    count = 0
    for user in users:
        for _ in range(gen.rng.randint(2, 4)):
            db.add(
                Notification(
                    user_id=user.id,
                    title=gen.rng.choice(
                        ["Welcome aboard", "Action required", "Report ready", "New assignment"]
                    ),
                    message="Seeded notification — replace with real domain events.",
                    is_read=gen.maybe(0.4),
                    created_at=gen.past_datetime(14),
                )
            )
            count += 1
    db.commit()
    return count


def seed_all(db: Session, *, seed_value: int = 42) -> dict[str, int]:
    """Everything, in dependency order. Importable — this is what tests call."""
    gen = Gen(seed_value)

    roles = seed_roles(db)
    users = seed_users(db, roles)
    notifications = seed_notifications(db, users, gen)
    accounts = seed_chart_of_accounts(db)
    journals = seed_journals(db, accounts)

    # The accounting domain: contacts, products, a month of trading, and the
    # budgets that measure it. Built through services/, so seeded data obeys
    # exactly the rules the API enforces (see seed/domain.py).
    admin = next((u for u in users if u.role_id == roles["Admin"].id), None)
    domain_counts = seed_domain(db, accounts, admin.id if admin else None, gen)

    return {
        "roles": len(roles),
        "users": len(users),
        "notifications": notifications,
        "accounts": len(accounts),
        "journals": len(journals),
        **domain_counts,
    }


def db_portal_login() -> tuple[str, str] | None:
    """The seeded portal user, looked up for the login summary."""
    db = SessionLocal()
    try:
        user = db.execute(
            select(User).where(User.email == "portal@urbanfurniture.in")
        ).scalar_one_or_none()
        return (user.email, user.full_name) if user else None
    finally:
        db.close()


def main() -> None:
    """Console entry point.

    ⚠️ REGRESSION GUARD: a merge once deleted this exact `def main():` line in the
    previous project. Python silently attached the body to the function above it, the
    file still imported, and the documented setup command was broken for weeks.
    `tests/test_seed_smoke.py` now imports and calls this — if the header disappears
    again, the test suite fails immediately.
    """
    # Windows consoles default to cp1252, which cannot encode the check mark
    # and box characters below — printing them raises UnicodeEncodeError and
    # the documented setup command dies *after* successfully seeding, which
    # reads exactly like a failed seed. Force UTF-8 on the way out instead of
    # giving up the formatting.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Seed demo data.")
    parser.add_argument(
        "--reset", action="store_true", help="DESTRUCTIVE: delete all rows first"
    )
    parser.add_argument(
        "--yes", action="store_true", help="skip the confirmation prompt"
    )
    parser.add_argument("--seed", type=int, default=42, help="RNG seed (default 42)")
    args = parser.parse_args()

    create_tables()
    db = SessionLocal()
    try:
        if args.reset:
            if not args.yes:
                print("\n  \033[1;31m⚠️  --reset will DELETE every row in:\033[0m")
                print("     notifications, users, roles, journals, accounts\n")
                print(f"     Database: {settings.database_url}\n")
                if input("  Type 'reset' to confirm: ").strip().lower() != "reset":
                    print("  Aborted. Nothing was changed.")
                    sys.exit(1)
            reset_tables(db)
            print("  Tables cleared.")

        counts = seed_all(db, seed_value=args.seed)
    finally:
        db.close()

    print("\n  \033[1;32m✅ Seed complete\033[0m")
    for label, value in counts.items():
        print(f"     {label:<16} {value}")

    print("\n  \033[1mDemo logins\033[0m (password for all: "
          f"\033[1m{settings.seed_password}\033[0m)")
    for email, full_name, role_name, _login_id in DEMO_USERS:
        print(f"     {email:<30} {role_name:<12} {full_name}")
    # Created in seed/domain.py alongside the contact it is scoped to, so it is
    # not in DEMO_USERS — but it is the login that demonstrates portal scoping,
    # and an undiscoverable demo account may as well not exist.
    portal = db_portal_login()
    if portal:
        print(f"     {portal[0]:<30} {'User':<12} {portal[1]} (portal)")
    print()


if __name__ == "__main__":
    main()
