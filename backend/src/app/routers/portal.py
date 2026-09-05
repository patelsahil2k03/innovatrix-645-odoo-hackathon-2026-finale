"""The contact portal (04_API_CONTRACT.md §3.9) — User role only.

Every query here is scoped to `contact_id = current_user.contact_id`. That is a
data-scoping rule rather than a role: the role gets you through the door, the
filter decides which rows exist for you.

**A document that is not yours returns 404, never 403.** A 403 confirms the
record exists, which leaks one customer's activity to another — the ids are
sequential enough to walk. Refusing to distinguish "not yours" from "not there"
is the whole point.
"""

from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.core.pagination import PageParams, page_params, paginate
from app.core.rbac import require_portal
from app.models.auth import User
from app.models.documents import CustomerInvoice, VendorBill
from app.schemas.common import Page
from app.schemas.documents import CustomerInvoiceOut, VendorBillOut
from app.schemas.payments import PaymentOut, PortalPaymentCreate
from app.services import payments as svc
from app.services.notify import emit_ledger_events
from app.services.rules import emit

router = APIRouter(prefix="/portal", tags=["portal"])


def _contact_id(user: User) -> str:
    """A portal user with no contact behind it can see nothing at all.

    Failing closed rather than open: an unscoped query here would return every
    document in the system to whoever hit it.
    """
    if not user.contact_id:
        raise AppError(
            "FORBIDDEN",
            "This portal account is not linked to a contact yet.",
            status_code=403,
        )
    return user.contact_id


@router.get("/invoices", response_model=Page[CustomerInvoiceOut])
def list_own_invoices(
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    user: User = Depends(require_portal),
) -> dict:
    return paginate(
        db,
        select(CustomerInvoice).where(
            CustomerInvoice.customer_id == _contact_id(user)
        ),
        params,
        sortable={
            "number": CustomerInvoice.number,
            "invoice_date": CustomerInvoice.invoice_date,
            "total": CustomerInvoice.total,
        },
        searchable=[CustomerInvoice.number, CustomerInvoice.reference],
        default_sort="-invoice_date",
    )


@router.get("/bills", response_model=Page[VendorBillOut])
def list_own_bills(
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    user: User = Depends(require_portal),
) -> dict:
    return paginate(
        db,
        select(VendorBill).where(VendorBill.vendor_id == _contact_id(user)),
        params,
        sortable={
            "number": VendorBill.number,
            "bill_date": VendorBill.bill_date,
            "total": VendorBill.total,
        },
        searchable=[VendorBill.number, VendorBill.reference],
        default_sort="-bill_date",
    )


@router.get("/documents")
def list_own_documents(
    db: Session = Depends(get_db),
    user: User = Depends(require_portal),
) -> dict:
    """The caller's invoices **and** bills in one list.

    A contact who is `BOTH` customer and vendor has each kind, and the portal's
    landing screen shows them together rather than making the person guess which
    tab their document is under. `document_type` distinguishes them.
    """
    contact_id = _contact_id(user)

    invoices = db.execute(
        select(CustomerInvoice)
        .where(CustomerInvoice.customer_id == contact_id)
        .order_by(CustomerInvoice.invoice_date.desc())
    ).scalars().all()
    bills = db.execute(
        select(VendorBill)
        .where(VendorBill.vendor_id == contact_id)
        .order_by(VendorBill.bill_date.desc())
    ).scalars().all()

    items = [
        {
            "document_type": "customer_invoice",
            "id": d.id,
            "number": d.number,
            "reference": d.reference,
            "date": d.invoice_date,
            "due_date": d.due_date,
            "status": d.status.value,
            "total": float(d.total),
            "amount_paid": float(d.amount_paid),
            "amount_due": float(d.total) - float(d.amount_paid),
        }
        for d in invoices
    ] + [
        {
            "document_type": "vendor_bill",
            "id": d.id,
            "number": d.number,
            "reference": d.reference,
            "date": d.bill_date,
            "due_date": d.due_date,
            "status": d.status.value,
            "total": float(d.total),
            "amount_paid": float(d.amount_paid),
            "amount_due": float(d.total) - float(d.amount_paid),
        }
        for d in bills
    ]
    items.sort(key=lambda row: row["date"], reverse=True)
    return {"items": items, "total": len(items)}


@router.get("/documents/{document_id}")
def get_own_document(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_portal),
) -> dict:
    """404 rather than 403 when the document is someone else's — see the module
    docstring. The two cases are answered identically on purpose."""
    contact_id = _contact_id(user)

    invoice = db.get(CustomerInvoice, document_id)
    if invoice is not None and invoice.customer_id == contact_id:
        return {
            "document_type": "customer_invoice",
            **CustomerInvoiceOut.model_validate(invoice).model_dump(mode="json"),
        }

    bill = db.get(VendorBill, document_id)
    if bill is not None and bill.vendor_id == contact_id:
        return {
            "document_type": "vendor_bill",
            **VendorBillOut.model_validate(bill).model_dump(mode="json"),
        }

    raise AppError("NOT_FOUND", "That document no longer exists.", 404)


@router.post("/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def pay_own_document(
    payload: PortalPaymentCreate,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(require_portal),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
):
    """Pay one of your own documents.

    `contact_scope` is passed into the service so the scoping check happens under
    the same lock as the balance check — a portal user cannot pay against a
    document that is not theirs, and the refusal is a 404 like every other
    cross-contact miss.
    """
    if not idempotency_key:
        raise AppError(
            "VALIDATION_ERROR",
            "An Idempotency-Key header is required so a retried payment cannot "
            "be recorded twice.",
            fields={"Idempotency-Key": "This header is required."},
        )
    contact_id = _contact_id(user)

    payment, created = svc.register_payment(
        db,
        payload,
        idempotency_key=idempotency_key,
        actor_id=user.id,
        contact_scope=contact_id,
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
