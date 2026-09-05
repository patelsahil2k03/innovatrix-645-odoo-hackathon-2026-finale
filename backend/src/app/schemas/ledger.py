"""Read-only ledger shapes.

There is no `JournalEntryCreate` in this file, and that absence is the point
(docs/04_API_CONTRACT.md §3.7): entries are created only as a side effect of
posting a document. A create schema here would be the first step towards a route
that lets someone hand-write the books.
"""

from datetime import date, datetime

from pydantic import AliasPath, Field

from app.models.ledger import EntryState
from app.schemas.common import Money, ORMModel


class JournalLineOut(ORMModel):
    id: str
    account_id: str
    account_code: str | None = Field(
        default=None, validation_alias=AliasPath("account", "code")
    )
    account_name: str | None = Field(
        default=None, validation_alias=AliasPath("account", "name")
    )
    analytic_account_id: str | None
    partner_id: str | None
    label: str | None
    debit: Money
    credit: Money


class JournalEntryOut(ORMModel):
    id: str
    entry_number: str
    journal_id: str
    journal_name: str | None = Field(
        default=None, validation_alias=AliasPath("journal", "name")
    )
    entry_date: date
    reference: str | None
    state: EntryState
    source_type: str
    source_id: str | None
    reversal_of_id: str | None
    posted_at: datetime | None
    lines: list[JournalLineOut] = []
