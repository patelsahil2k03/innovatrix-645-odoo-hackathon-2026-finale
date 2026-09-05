"""Payments (04_API_CONTRACT.md §3.4).

`Idempotency-Key` is required on create. A double-clicked Pay button otherwise
produces two payments and two perfectly balanced journal entries — the trial
balance stays at zero and the books are still wrong, which is exactly why the
guard has to be a header the client sends rather than something the server can
infer after the fact.
"""

from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.core.pagination import PageParams, page_params, paginate
from app.core.rbac import require_internal, require_txn_write
from app.models.auth import User
from app.models.payments import Payment, PaymentDirection
from app.schemas.common import Page
from app.schemas.payments import PaymentCreate, PaymentOut
from app.services import payments as svc
from app.services.notify import emit_ledger_events
from app.services.rules import emit

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("", response_model=Page[PaymentOut])
def list_payments(
    contact_id: str | None = None,
    direction: PaymentDirection | None = None,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    stmt = select(Payment)
    if contact_id is not None:
        stmt = stmt.where(Payment.contact_id == contact_id)
    if direction is not None:
        stmt = stmt.where(Payment.direction == direction)
    return paginate(
        db, stmt, params,
        sortable={
            "number": Payment.number,
            "payment_date": Payment.payment_date,
            "amount": Payment.amount,
        },
        searchable=[Payment.number, Payment.note],
        default_sort="-payment_date",
    )


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
):
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise AppError("NOT_FOUND", "That payment no longer exists.", 404)
    return payment


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(
    payload: PaymentCreate,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(require_txn_write),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """Register a payment and post it, in one transaction.

    A replayed `Idempotency-Key` returns the original payment with **200**
    instead of creating a second one — a retry is not an error, and answering
    409 would push the client into an error path for something that succeeded.
    The `DUPLICATE_PAYMENT` code in the registry covers the genuinely conflicting
    case: the same key reused for a *different* payment.
    """
    if not idempotency_key:
        raise AppError(
            "VALIDATION_ERROR",
            "An Idempotency-Key header is required so a retried payment cannot "
            "be recorded twice.",
            fields={"Idempotency-Key": "This header is required."},
        )

    existing = svc.find_by_idempotency_key(db, idempotency_key)
    if existing is not None:
        # Same key, different payment: the client reused a key it should not
        # have, and returning the unrelated original would be worse than an error.
        conflicting = (
            existing.invoice_id != payload.invoice_id
            or existing.bill_id != payload.bill_id
            or existing.amount != payload.amount
        )
        if conflicting:
            raise AppError(
                "DUPLICATE_PAYMENT",
                "That Idempotency-Key has already been used for a different "
                "payment.",
                status_code=409,
            )
        response.status_code = status.HTTP_200_OK
        return existing

    payment, created = svc.register_payment(
        db, payload, idempotency_key=idempotency_key, actor_id=user.id
    )
    db.commit()
    db.refresh(payment)

    if not created:
        response.status_code = status.HTTP_200_OK
        return payment

    emit(
        "payment.registered",
        id=payment.id, contact=payment.contact_id, amount=float(payment.amount),
    )
    emit_ledger_events(db)
    return payment
