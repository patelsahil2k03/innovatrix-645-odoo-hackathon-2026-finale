"""★ THE BUSINESS-RULE ENGINE — the most important file you will write. ★

Everything the problem statement says "must not" or "automatically" belongs here,
NOT in a router and NOT in the frontend.

Why one place: the API and the background task both mutate the same data. If a rule
lives in a router, the background task bypasses it and your "live" data quietly
violates your own constraints. One code path, one set of rules.

═══════════════════════════════════════════════════════════════════════════════
 THE LOCKING RULE — read this before writing a state transition
═══════════════════════════════════════════════════════════════════════════════
In the previous hackathon we shipped a real concurrency bug: transitions locked the
related rows (vehicle, driver) but never the row actually being mutated (the trip),
and never re-checked its status after taking the locks. Two concurrent requests could
both read status="dispatched", both pass the guard, and both apply the completion —
producing a duplicate child record and a duplicate event.

The fix is a discipline, not a library:

    1. LOCK the row you are about to mutate  (and any row you are reading to decide)
    2. RE-CHECK its state AFTER the lock is held
    3. Mutate
    4. Commit
    5. THEN publish the event

Step 2 is the one everybody skips. A check made before the lock is a check made
against a value that may already be stale.
"""

from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.events import hub
from app.core.settings import get_settings

settings = get_settings()

T = TypeVar("T")


def lock_row(db: Session, model: type[T], row_id: str) -> T | None:
    """Fetch a row with a write lock held until the transaction ends.

    PostgreSQL: real `SELECT ... FOR UPDATE`.
    SQLite: no row-level locking exists, but SQLite serialises write transactions
    at the database level, which gives the same safety for our purposes. We skip the
    clause rather than crash, so the identical code runs on both backends.

    `FOR UPDATE OF <table>` — not a bare `FOR UPDATE` — because several of these
    models (SalesOrder, PurchaseOrder, VendorBill, CustomerInvoice) declare their
    contact/vendor/customer relationship as `lazy="joined"`. The ORM folds that
    into this SELECT as a LEFT OUTER JOIN automatically, and Postgres rejects a
    bare `FOR UPDATE` on the nullable side of an outer join outright — it never
    showed up on SQLite because `FOR UPDATE` is silently dropped there. Naming
    the table locks only the row being mutated, leaves the joined contact
    unlocked (correct — we're not mutating it), and works with or without the
    join present.
    """
    stmt = select(model).where(model.id == row_id)
    if not settings.is_sqlite:
        stmt = stmt.with_for_update(of=model)
    return db.execute(stmt).scalar_one_or_none()


def require(condition: bool, code: str, message: str, **fields: str) -> None:
    """Guard clause that produces a proper enveloped 422.

        require(qty <= capacity, "EXCEEDS_CAPACITY",
                "Quantity is above this item's capacity.", quantity="Too large")
    """
    if not condition:
        raise AppError(code, message, fields=fields or None)


def require_status(current, expected, *, code: str = "INVALID_STATUS_TRANSITION") -> None:
    """Re-check AFTER the lock, before mutating. This is step 2 above."""
    if current != expected:
        raise AppError(
            code,
            f"This item is '{getattr(current, 'value', current)}', "
            f"so that action is not available.",
        )


def emit(event: str, **data) -> None:
    """Publish an SSE event. Call this AFTER db.commit(), never before —
    a listener must never be told about a change that then rolls back."""
    hub.publish(event, data)


# ══════════════════════════════════════════════════════════════════════════════
# ★ WORKED PATTERN — copy this shape for every state transition in your PS.
#   Delete it once you have your own.
# ══════════════════════════════════════════════════════════════════════════════
#
# def activate_order(db: Session, order_id: str, actor_id: str) -> "Order":
#     from app.models.domain import Order, OrderStatus
#
#     # 1. LOCK the row we are about to mutate
#     order = lock_row(db, Order, order_id)
#     if order is None:
#         raise AppError("NOT_FOUND", "That order no longer exists.", 404)
#
#     # 2. RE-CHECK state now that the lock is held
#     require_status(order.status, OrderStatus.DRAFT, code="ORDER_NOT_DRAFT")
#
#     # 2b. Any cross-entity rule: lock those rows too, then check them
#     item = lock_row(db, Item, order.item_id)
#     require(item is not None and item.is_available,
#             "ITEM_UNAVAILABLE", "That item is not currently available.")
#     require(order.quantity <= item.capacity,
#             "EXCEEDS_CAPACITY", "Quantity is above this item's capacity.",
#             quantity=f"Must be at most {item.capacity}")
#
#     # 3. Mutate — including the cascading status changes the PS demands
#     order.status = OrderStatus.ACTIVE
#     order.activated_at = utc_now()
#     item.is_available = False
#
#     # 4. Commit
#     db.commit()
#     db.refresh(order)
#
#     # 5. THEN publish
#     emit("order.activated", id=order.id, status=order.status.value)
#     return order
