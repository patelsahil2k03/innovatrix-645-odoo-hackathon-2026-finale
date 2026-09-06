"""Gapless document and entry numbers (docs/03_DATA_MODEL.md §5).

Never `MAX(number) + 1`. That reads a value, and between the read and the insert
a second request reads the same value — two documents then claim one number, and
on a unique index one of them dies with a 500 in front of a judge. Instead every
number comes from a locked row in `number_sequences`: the lock is taken first,
so the second request waits rather than racing.

Gaplessness is not decoration. A gap in an accounting sequence is a real audit
finding, because it is indistinguishable from a deleted document.
"""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.models.ledger import NumberSequence

settings = get_settings()

# kind -> (format, is_year_scoped). The four document formats are the mockup's
# own; JE and PAY are ours (§5) — five digits, because every payment and every
# reversal adds an entry without a document of its own, so entries outrun
# documents quickly.
FORMATS: dict[str, tuple[str, bool]] = {
    "inv": ("INV/{year}/{seq:04d}", True),
    "bill": ("Bill/{year}/{seq:04d}", True),
    "so": ("S{seq:05d}", False),
    "po": ("P{seq:05d}", False),
    "je": ("JE/{year}/{seq:05d}", True),
    "pay": ("PAY/{year}/{seq:05d}", True),
}


def _lock_sequence(db: Session, key: str) -> NumberSequence:
    """Fetch the sequence row with a write lock, creating it on first use.

    The create is wrapped in a SAVEPOINT rather than a plain try/except: if two
    requests both find the row missing, one insert loses on the primary key, and
    a bare rollback there would discard the caller's whole transaction — the
    half-built invoice included. A savepoint rolls back only the failed insert,
    after which the row exists and the re-read below finds it.
    """
    stmt = select(NumberSequence).where(NumberSequence.key == key)
    if not settings.is_sqlite:
        stmt = stmt.with_for_update()

    row = db.execute(stmt).scalar_one_or_none()
    if row is not None:
        return row

    try:
        with db.begin_nested():
            db.add(NumberSequence(key=key, next_value=1))
            db.flush()
    except IntegrityError:
        pass  # someone else created it first; the re-read below picks it up

    return db.execute(stmt).scalar_one()


def next_number(db: Session, kind: str, year: int | None = None) -> str:
    """Allocate the next number for `kind`, formatted per §5.

    Must be called inside the same transaction as the insert it numbers. The
    lock is held until that transaction ends, which is what makes the sequence
    safe — commit promptly.
    """
    if kind not in FORMATS:
        raise ValueError(f"Unknown number kind {kind!r}; expected one of {sorted(FORMATS)}")

    template, year_scoped = FORMATS[kind]
    if year_scoped and year is None:
        raise ValueError(f"{kind!r} numbers are year-scoped; pass the document's year")

    key = f"{kind}:{year}" if year_scoped else kind
    row = _lock_sequence(db, key)

    seq = row.next_value
    row.next_value = seq + 1
    db.flush()

    return template.format(year=year, seq=seq)
