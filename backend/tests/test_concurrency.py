"""The bug we already shipped once — docs/07_TESTING_AND_REVIEW.md §1.3.

Two requests racing to post the same document must produce exactly one journal
entry. The `UNIQUE(source_type, source_id) WHERE state != 'REVERSED'` index
(tested for real in test_schema_constraints.py) is the backstop; this test
proves the *service* layer catches the race with a lock, not a 500 from a raw
constraint violation. Requires two live sessions against a shared database, so
it needs a file-backed SQLite (not the in-memory `db` fixture) and the not-yet-
built posting/documents services — skips cleanly until both exist.
"""

import threading

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base

posting = pytest.importorskip(
    "app.services.posting", reason="pending: app/services/posting.py — row-locking discipline"
)
documents = pytest.importorskip(
    "app.services.documents", reason="pending: app/services/documents.py"
)


@pytest.fixture()
def file_engine(tmp_path):
    eng = create_engine(f"sqlite+pysqlite:///{tmp_path}/concurrency.db")
    Base.metadata.create_all(eng)
    return eng


def test_concurrent_posting_creates_exactly_one_entry(file_engine, today):
    """Two threads race to post the same invoice; the loser gets ALREADY_POSTED,
    never a duplicate journal entry — and the trial balance alone would not
    have revealed the bug, which is exactly why this test exists."""
    from app.core.errors import AppError

    setup_session = Session(file_engine)
    # seed minimal chart of accounts / journal / customer / invoice with one line
    # ... (seeding omitted here; mirrors the `chart_of_accounts`/`journals`/`customer`
    #      fixtures in conftest.py against `file_engine` instead of the in-memory engine)
    invoice_id = None  # placeholder until documents.create_invoice() exists
    setup_session.close()

    results = []

    def _attempt():
        session = Session(file_engine)
        try:
            documents.confirm_and_post_invoice(session, invoice_id, actor_id=None)
            results.append("posted")
        except AppError as exc:
            results.append(exc.code)
        finally:
            session.close()

    threads = [threading.Thread(target=_attempt) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(results) == ["ALREADY_POSTED", "posted"]

    verify_session = Session(file_engine)
    from app.models import JournalEntry

    count = (
        verify_session.query(JournalEntry)
        .filter(JournalEntry.source_type == "customer_invoice", JournalEntry.source_id == invoice_id)
        .count()
    )
    verify_session.close()
    assert count == 1
