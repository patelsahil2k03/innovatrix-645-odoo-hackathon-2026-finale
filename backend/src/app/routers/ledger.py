"""The ledger — read-only, and that is the point (04_API_CONTRACT.md §3.7).

There is no POST, PATCH or DELETE in this file. Entries exist only as a side
effect of posting a document, and corrections go through `/cancel`, which writes
a reversing entry. A route that let someone hand-write a journal entry would
make every guarantee in `services/posting.py` optional.
"""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.core.pagination import PageParams, page_params, paginate
from app.core.rbac import require_internal
from app.models.auth import User
from app.models.ledger import EntryState, JournalEntry, JournalLine
from app.schemas.common import Page
from app.schemas.ledger import JournalEntryOut

router = APIRouter(prefix="/journal-entries", tags=["ledger"])


@router.get("", response_model=Page[JournalEntryOut])
def list_journal_entries(
    journal_id: str | None = None,
    account_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    state: EntryState | None = None,
    source_type: str | None = None,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    """Walk the ledger. `account_id` is what the report drill-down calls."""
    stmt = select(JournalEntry)
    if journal_id is not None:
        stmt = stmt.where(JournalEntry.journal_id == journal_id)
    if account_id is not None:
        # A semi-join rather than a plain join: an entry with two lines on the
        # same account would otherwise appear twice in the list.
        stmt = stmt.where(
            JournalEntry.id.in_(
                select(JournalLine.entry_id).where(JournalLine.account_id == account_id)
            )
        )
    if date_from is not None:
        stmt = stmt.where(JournalEntry.entry_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(JournalEntry.entry_date <= date_to)
    if state is not None:
        stmt = stmt.where(JournalEntry.state == state)
    if source_type is not None:
        stmt = stmt.where(JournalEntry.source_type == source_type)

    return paginate(
        db, stmt, params,
        sortable={
            "entry_number": JournalEntry.entry_number,
            "entry_date": JournalEntry.entry_date,
            "state": JournalEntry.state,
        },
        searchable=[JournalEntry.entry_number, JournalEntry.reference],
        default_sort="-entry_date",
    )


@router.get("/{entry_id}", response_model=JournalEntryOut)
def get_journal_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
):
    entry = db.get(JournalEntry, entry_id)
    if entry is None:
        raise AppError("NOT_FOUND", "That journal entry no longer exists.", 404)
    return entry
