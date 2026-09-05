"""Shared fixtures for the domain test suite.

Uses an in-memory SQLite engine so these tests need no external database and
run in well under a second — they exist to pin the *schema*, not to prove
PostgreSQL parity (that's what `alembic upgrade head` against a real Postgres
in CI/the demo environment is for).
"""

from datetime import date

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from app.models import (
    Account,
    AnalyticAccount,
    Base,
    Contact,
    Journal,
    Product,
    ProductCategory,
)
from app.models.enums import AccountType, AnalyticType, ContactType, JournalType, ProductType


@pytest.fixture()
def engine():
    eng = create_engine("sqlite+pysqlite:///:memory:")

    @event.listens_for(eng, "connect")
    def _enable_fk(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    return eng


@pytest.fixture()
def db(engine):
    session = Session(engine)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def chart_of_accounts(db):
    """The minimal Chart of Accounts from docs/03_DATA_MODEL.md §8 — nothing can post without it."""
    accounts = {
        "cash": Account(code="1000", name="Cash", type=AccountType.CASH),
        "bank": Account(code="1010", name="Bank", type=AccountType.BANK),
        "debtors": Account(code="1100", name="Debtors", type=AccountType.ASSET),
        "input_tax": Account(code="1200", name="Input Tax", type=AccountType.ASSET),
        "creditors": Account(code="2000", name="Creditors", type=AccountType.LIABILITY),
        "output_tax": Account(code="2100", name="Output Tax", type=AccountType.LIABILITY),
        "capital": Account(code="3000", name="Capital", type=AccountType.CAPITAL),
        "sales_income": Account(code="4000", name="Sales Income", type=AccountType.INCOME),
        "purchase_expense": Account(code="5000", name="Purchase Expense", type=AccountType.EXPENSE),
        "other_expense": Account(code="5100", name="Other Expense", type=AccountType.OTHER_EXPENSE),
    }
    db.add_all(accounts.values())
    db.flush()
    return accounts


@pytest.fixture()
def journals(db, chart_of_accounts):
    sales = Journal(
        name="Sales",
        type=JournalType.SALES,
        default_debit_account_id=chart_of_accounts["debtors"].id,
        default_credit_account_id=chart_of_accounts["sales_income"].id,
    )
    purchase = Journal(
        name="Purchase",
        type=JournalType.PURCHASE,
        default_debit_account_id=chart_of_accounts["purchase_expense"].id,
        default_credit_account_id=chart_of_accounts["creditors"].id,
    )
    bank = Journal(
        name="Bank",
        type=JournalType.BANK,
        default_debit_account_id=chart_of_accounts["bank"].id,
        default_credit_account_id=chart_of_accounts["bank"].id,
    )
    db.add_all([sales, purchase, bank])
    db.flush()
    return {"sales": sales, "purchase": purchase, "bank": bank}


@pytest.fixture()
def customer(db, chart_of_accounts):
    contact = Contact(
        name="Test Customer",
        type=ContactType.CUSTOMER,
        email="customer@example.test",
        receivable_account_id=chart_of_accounts["debtors"].id,
    )
    db.add(contact)
    db.flush()
    return contact


@pytest.fixture()
def vendor(db, chart_of_accounts):
    contact = Contact(
        name="Test Vendor",
        type=ContactType.VENDOR,
        email="vendor@example.test",
        payable_account_id=chart_of_accounts["creditors"].id,
    )
    db.add(contact)
    db.flush()
    return contact


@pytest.fixture()
def product(db, chart_of_accounts):
    category = ProductCategory(name="Furniture")
    db.add(category)
    db.flush()
    item = Product(
        name="Office Chair",
        type=ProductType.GOODS,
        sales_price=1000,
        cost_price=600,
        category_id=category.id,
        sales_tax_pct=18,
        income_account_id=chart_of_accounts["sales_income"].id,
        expense_account_id=chart_of_accounts["purchase_expense"].id,
    )
    db.add(item)
    db.flush()
    return item


@pytest.fixture()
def analytic_accounts(db):
    income = AnalyticAccount(name="Project Alpha - Sales", type=AnalyticType.INCOME)
    expense = AnalyticAccount(name="Project Alpha - Costs", type=AnalyticType.EXPENSE)
    db.add_all([income, expense])
    db.flush()
    return {"income": income, "expense": expense}


@pytest.fixture()
def today() -> date:
    return date(2026, 9, 5)


@pytest.fixture()
def client():
    """FastAPI TestClient — skips cleanly until app/main.py exists (docs/02_ARCHITECTURE.md)."""
    main = pytest.importorskip(
        "app.main", reason="pending: app/main.py — FastAPI app factory not built yet"
    )
    from fastapi.testclient import TestClient

    with TestClient(main.app) as test_client:
        yield test_client
