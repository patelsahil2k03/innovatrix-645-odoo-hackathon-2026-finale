"""★ THE POSTING ENGINE ★ — the only code in this system that writes journal lines.

Every document that posts calls `post_entry`, and every correction calls
`reverse_entry`. Nothing else may insert into `journal_lines`; if a second write
path ever appears, the invariants below stop being guarantees and become hopes.

The invariants, in the order they are enforced (docs/06_BACKEND.md §2):

    1. REJECT   unbalanced, empty, or archived-account postings before writing
    2. GUARD    against a second live entry for the same source document
    3. ALLOCATE the entry number from a locked sequence row
    4. WRITE    the entry and its lines
    5. the CALLER commits, then publishes

On step 5 this file deliberately differs from the pseudocode in 06_BACKEND.md §2,
which commits inside `post_entry`. It flushes instead and leaves the commit to the
caller, because posting is never the only thing happening in its transaction —
registering a payment also moves `amount_paid` and the document's status, and a
commit in the middle of that would leave a committed journal entry behind if the
status update then failed. Same rule, one level up: the caller commits, and only
then emits. Every guarantee the doc asks for still holds; the transaction
boundary is simply where it belongs.
"""

import logging
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.base import utc_now
from app.models.ledger import EntryState, JournalEntry, JournalLine
from app.models.masters import Account, Journal
from app.services.money import q2
from app.services.numbering import next_number

logger = logging.getLogger(__name__)

ZERO = Decimal("0.00")

LEDGER_STATES = (EntryState.POSTED, EntryState.REVERSED)
"""The entry states whose lines count toward every balance and every report.

REVERSED is in this tuple, and that is not an oversight. `REVERSED` marks an entry
as *superseded* — it is what lets the partial unique index release the source
document so a correction can be posted against it — but it does **not** mean void.
The entry really did hit the books, and what cancels it is its reversal, not its
exclusion.

Filtering reports on `state == POSTED` alone is the subtle version of this bug:
the original drops out while its mirror image stays in, so every account ends up
showing the exact negative of the transaction that was reversed. The trial balance
still reads 0.00 either way, which is precisely why the mistake survives review —
a balanced ledger and a *correct* ledger are not the same claim.

Both entries in, netting to zero, is what 06_BACKEND.md §2 means by "two entries
now exist, both immutable, and the trial balance still lands on zero". Every
aggregation in `services/reports.py` uses this constant; none of them re-spell
the filter by hand.
"""


@dataclass
class LineDraft:
    """One side of an entry, before it becomes a row.

    `account` is the object, not an id, so `post_entry` can check `is_archived`
    without a second query per line.
    """

    account: Account
    debit: Decimal = ZERO
    credit: Decimal = ZERO
    label: str | None = None
    analytic_account_id: str | None = None
    partner_id: str | None = None

    def rounded(self) -> "LineDraft":
        return LineDraft(
            account=self.account,
            debit=q2(self.debit),
            credit=q2(self.credit),
            label=self.label,
            analytic_account_id=self.analytic_account_id,
            partner_id=self.partner_id,
        )


@dataclass
class EntryDraft:
    journal: Journal
    entry_date: date
    source_type: str
    source_id: str | None
    reference: str | None = None
    lines: list[LineDraft] = field(default_factory=list)


def _validate(lines: list[LineDraft]) -> list[LineDraft]:
    """Round, then reject anything that must never reach the ledger."""
    if not lines:
        raise AppError(
            "EMPTY_DOCUMENT", "There is nothing to post — this document has no lines."
        )

    rounded = [line.rounded() for line in lines]

    for line in rounded:
        if line.account is None:
            raise AppError(
                "MISSING_ACCOUNT_MAPPING",
                "This posting has a line with no account to post to.",
            )
        if line.debit < ZERO or line.credit < ZERO:
            raise AppError(
                "UNBALANCED_ENTRY", "A journal line cannot carry a negative amount."
            )
        if line.debit > ZERO and line.credit > ZERO:
            raise AppError(
                "UNBALANCED_ENTRY",
                "A journal line is one-sided — it cannot be both a debit and a credit.",
            )
        if line.debit == ZERO and line.credit == ZERO:
            raise AppError(
                "UNBALANCED_ENTRY", "A journal line must carry a debit or a credit."
            )
        if line.account.is_archived:
            raise AppError(
                "ACCOUNT_ARCHIVED",
                f"Account {line.account.code} {line.account.name} is archived and "
                "cannot receive new postings.",
            )

    total_debit = sum((line.debit for line in rounded), ZERO)
    total_credit = sum((line.credit for line in rounded), ZERO)
    if total_debit != total_credit:
        # The last guard before the ledger. Reaching this means a posting rule
        # above built an entry wrong — it is a bug, not bad user input, and the
        # message says so rather than blaming the person who clicked Post.
        raise AppError(
            "UNBALANCED_ENTRY",
            f"This entry does not balance: debit {total_debit} against "
            f"credit {total_credit}.",
        )

    return rounded


def _guard_not_already_posted(db: Session, source_type: str, source_id: str | None) -> None:
    """One live entry per source document.

    `UNIQUE(source_type, source_id) WHERE state != 'REVERSED'` is the real
    backstop; this check exists so a double-click returns a clean 409 instead of
    an IntegrityError surfacing as a 500.
    """
    if source_id is None:
        return
    existing = db.execute(
        select(JournalEntry).where(
            JournalEntry.source_type == source_type,
            JournalEntry.source_id == source_id,
            JournalEntry.state != EntryState.REVERSED,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise AppError(
            "ALREADY_POSTED",
            f"This document is already posted as {existing.entry_number}.",
            status_code=409,
        )


def post_entry(
    db: Session,
    *,
    journal: Journal,
    entry_date: date,
    reference: str | None,
    source_type: str,
    source_id: str | None,
    lines: list[LineDraft],
    actor_id: str | None,
    reversal_of_id: str | None = None,
) -> JournalEntry:
    """Create one balanced, POSTED journal entry. Flushes; does not commit."""
    validated = _validate(lines)
    _guard_not_already_posted(db, source_type, source_id)

    entry = JournalEntry(
        entry_number=next_number(db, "je", entry_date.year),
        journal_id=journal.id,
        entry_date=entry_date,
        reference=reference,
        state=EntryState.POSTED,
        source_type=source_type,
        source_id=source_id,
        reversal_of_id=reversal_of_id,
        posted_at=utc_now(),
        posted_by_id=actor_id,
    )
    db.add(entry)
    db.flush()

    db.add_all(
        [
            JournalLine(
                entry_id=entry.id,
                account_id=line.account.id,
                analytic_account_id=line.analytic_account_id,
                partner_id=line.partner_id,
                label=line.label,
                debit=line.debit,
                credit=line.credit,
            )
            for line in validated
        ]
    )
    db.flush()
    return entry


def reverse_entry(
    db: Session, entry: JournalEntry, *, actor_id: str | None, reason: str | None = None
) -> JournalEntry:
    """Correct a posted entry by writing its mirror image.

    Nothing is mutated and nothing is deleted: the original stays exactly as it
    was posted and is marked REVERSED, and a second entry carries the same lines
    with debit and credit swapped. Two immutable entries, a trial balance still
    at zero, and an audit trail that shows what happened rather than hiding it.
    """
    if entry.state is EntryState.REVERSED:
        raise AppError(
            "CANNOT_MODIFY_POSTED",
            "This entry has already been reversed.",
            status_code=409,
        )

    swapped = [
        LineDraft(
            account=line.account,
            debit=line.credit,
            credit=line.debit,
            label=f"Reversal: {line.label}" if line.label else "Reversal",
            analytic_account_id=line.analytic_account_id,
            partner_id=line.partner_id,
        )
        for line in entry.lines
    ]

    # Marked before the new entry is written so the partial unique index sees
    # the original as superseded and lets the reversal claim the same source.
    entry.state = EntryState.REVERSED
    db.flush()

    return post_entry(
        db,
        journal=entry.journal,
        entry_date=entry.entry_date,
        reference=reason or f"Reversal of {entry.entry_number}",
        source_type=entry.source_type,
        source_id=entry.source_id,
        lines=swapped,
        actor_id=actor_id,
        reversal_of_id=entry.id,
    )


def trial_balance_summary(db: Session) -> dict[str, object]:
    """Total debit, total credit, and whether they agree, across every posted line.

    This is what the live `Trial balance 0.00` badge reads. It is recomputed from
    the ledger on every call — the badge asserts nothing it has not just measured.
    """
    row = db.execute(
        select(
            func.coalesce(func.sum(JournalLine.debit), 0),
            func.coalesce(func.sum(JournalLine.credit), 0),
        )
        .select_from(JournalLine)
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .where(JournalEntry.state.in_(LEDGER_STATES))
    ).one()

    total_debit, total_credit = q2(Decimal(row[0])), q2(Decimal(row[1]))
    difference = total_debit - total_credit
    return {
        "total_debit": float(total_debit),
        "total_credit": float(total_credit),
        "difference": float(difference),
        "is_balanced": difference == ZERO,
    }
