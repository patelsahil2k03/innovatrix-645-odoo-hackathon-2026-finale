"""Test fixtures.

Environment is configured BEFORE any app module is imported, because settings are
cached and the SQLAlchemy engine is built at import time.
"""

import os
import pathlib
import tempfile

_TEST_DB = pathlib.Path(tempfile.gettempdir()) / "hackathon_boilerplate_test.db"
if _TEST_DB.exists():
    _TEST_DB.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
os.environ["SIMULATOR_ENABLED"] = "false"
os.environ["JWT_SECRET"] = "test-only-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import SessionLocal, engine  # noqa: E402
from app.core.settings import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
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
def portal_client() -> TestClient:
    """The seeded contact-portal login (role `User`).

    `portal@`, not `customer@`: the portal user is a login that points at a
    customer contact, not the contact's own address. The login page had the
    wrong one of those two hard-coded, so the portal could not be signed into
    at all — this fixture is the regression guard for that.
    """
    c = TestClient(app)
    response = c.post(
        "/api/v1/auth/login",
        json={"email": "portal@urbanfurniture.in", "password": settings.seed_password},
    )
    assert response.status_code == 200, response.text
    return c


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
