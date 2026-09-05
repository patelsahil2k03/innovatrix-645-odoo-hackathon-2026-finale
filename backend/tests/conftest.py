"""Test fixtures.

Environment is configured BEFORE any app module is imported, because settings are
cached and the SQLAlchemy engine is built at import time.
"""

import os
import pathlib
import tempfile
from datetime import date

_TEST_DB = pathlib.Path(tempfile.gettempdir()) / "hackathon_boilerplate_test.db"
if _TEST_DB.exists():
    _TEST_DB.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
os.environ["SIMULATOR_ENABLED"] = "false"
os.environ["JWT_SECRET"] = "test-only-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal, engine  # noqa: E402
from app.core.settings import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    Account,
    AnalyticAccount,
    Base,
    Contact,
    Journal,
    Product,
    ProductCategory,
)
from app.models.masters import AnalyticType, ContactType, ProductType  # noqa: E402
from app.seed.seed import seed_all  # noqa: E402

settings = get_settings()


@pytest.fixture(scope="session", autouse=True)
def _database() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_all(db)
    finally:
        db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def admin_client(client: TestClient) -> TestClient:
    """Client with the auth cookie already set (Administrator)."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@urbanfurniture.in", "password": settings.seed_password},
    )
    assert response.status_code == 200, response.text
    return client


@pytest.fixture
def second_user_client() -> TestClient:
    """A signed-in client distinct from admin_client — for scoping tests, not
    permission tests. Logs in as the seeded Accountant."""
    c = TestClient(app)
    response = c.post(
        "/api/v1/auth/login",
        json={"email": "accountant@urbanfurniture.in", "password": settings.seed_password},
    )
    assert response.status_code == 200, response.text
    return c


# ---------------------------------------------------------------------------
# Accounting-domain fixtures.
#
# The Chart of Accounts and the four Journals are already seeded once per test
# session by `seed_all()` above (see app/seed/seed.py) — these fixtures fetch
# that seeded data by code/name rather than inserting a second copy, which
# would collide with the seed's own UNIQUE constraints. Contacts, products and
# analytic accounts are NOT seeded (docs/03_DATA_MODEL.md §8 marks them ★ —
# each feature's own domain data), so those fixtures create fresh rows; the
# per-test `db` session above rolls back anything not explicitly committed, so
# repeated inserts across tests never collide.
# ---------------------------------------------------------------------------

_ACCOUNT_CODES = {
    "cash": "1000",
    "bank": "1010",
    "debtors": "1100",
    "input_tax": "1200",
    "creditors": "2000",
    "output_tax": "2100",
    "capital": "3000",
    "sales_income": "4000",
    "purchase_expense": "5000",
    "other_expense": "5100",
}


@pytest.fixture()
def chart_of_accounts(db) -> dict[str, Account]:
    by_code = {a.code: a for a in db.execute(select(Account)).scalars().all()}
    return {label: by_code[code] for label, code in _ACCOUNT_CODES.items()}


@pytest.fixture()
def journals(db) -> dict[str, Journal]:
    by_name = {j.name: j for j in db.execute(select(Journal)).scalars().all()}
    return {
        "sales": by_name["Sales"],
        "purchase": by_name["Purchase"],
        "bank": by_name["Bank"],
        "cash": by_name["Cash"],
    }


@pytest.fixture()
def customer(db, chart_of_accounts) -> Contact:
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
def vendor(db, chart_of_accounts) -> Contact:
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
def product(db, chart_of_accounts) -> Product:
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
def analytic_accounts(db) -> dict[str, AnalyticAccount]:
    income = AnalyticAccount(name="Project Alpha - Sales", type=AnalyticType.INCOME)
    expense = AnalyticAccount(name="Project Alpha - Costs", type=AnalyticType.EXPENSE)
    db.add_all([income, expense])
    db.flush()
    return {"income": income, "expense": expense}


@pytest.fixture()
def today() -> date:
    return date(2026, 9, 5)
