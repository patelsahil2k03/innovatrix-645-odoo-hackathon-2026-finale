"""The SSE frames that fire after a posting (04_API_CONTRACT.md §3.10).

These are what make the `Trial balance 0.00` badge and the dashboard tiles live
rather than merely fresh-on-reload. Call `emit_ledger_events` **after** the
commit, never before: a listener told about a change that then rolls back is
worse than a listener told nothing.
"""

import logging
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.base import utc_now
from app.services.posting import trial_balance_summary
from app.services.reports import kpis
from app.services.rules import emit

logger = logging.getLogger(__name__)


def _plain(value: object) -> object:
    """Decimals do not survive JSON serialisation in an SSE frame."""
    return float(value) if isinstance(value, Decimal) else value


def emit_ledger_events(db: Session) -> None:
    """`ledger.changed` and `kpi.refresh`, recomputed from the ledger.

    Both payloads are measured, not passed in by the caller: the badge asserts
    what the database actually says at this moment, so a posting path that
    forgets to update a running total cannot make it lie.

    Report errors are swallowed deliberately. The document is already committed
    by the time this runs, and failing to describe a successful posting must not
    turn it into a failed request — the next event, or a page refresh, corrects
    the display.
    """
    try:
        emit("ledger.changed", **trial_balance_summary(db))
        emit("kpi.refresh", **{k: _plain(v) for k, v in kpis(db, utc_now().date()).items()})
    except Exception:  # noqa: BLE001 — telemetry must never fail a committed write
        logger.warning("Could not publish ledger events after a posting", exc_info=True)
