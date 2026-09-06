"""The sales chain (04_API_CONTRACT.md §3.3).

    Sales Order       DRAFT -> CONFIRMED -> INVOICED -> (CANCELLED)
    Customer Invoice  DRAFT -> POSTED -> PARTIAL -> PAID -> (CANCELLED)

The mirror of `purchases.py`, and deliberately written out rather than shared
with it through a factory: the two chains use different field names on every
document, and the shared version reads worse than either half. Master data is
factored (`masters.py`) because those six really are the same shape; these two
only look it.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PageParams, page_params, paginate
from app.core.rbac import require_admin, require_internal, require_txn_write
from app.models.auth import User
from app.models.documents import (
    CustomerInvoice,
    CustomerInvoiceStatus,
    SalesOrder,
    SalesOrderStatus,
)
from app.schemas.common import Page
from app.schemas.documents import (
    CustomerInvoiceCreate,
    CustomerInvoiceOut,
    CustomerInvoiceUpdate,
    SalesOrderCreate,
    SalesOrderOut,
    SalesOrderUpdate,
)
from app.services import documents as svc
from app.services.notify import emit_ledger_events
from app.services.rules import emit

router = APIRouter()

orders = APIRouter(prefix="/sales-orders", tags=["sales"])
invoices = APIRouter(prefix="/customer-invoices", tags=["sales"])


# ── Sales orders ──────────────────────────────────────────────────────────────


@orders.get("", response_model=Page[SalesOrderOut])
def list_sales_orders(
    status_filter: SalesOrderStatus | None = Query(None, alias="status"),
    customer_id: str | None = None,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    stmt = select(SalesOrder)
    if status_filter is not None:
        stmt = stmt.where(SalesOrder.status == status_filter)
    if customer_id is not None:
        stmt = stmt.where(SalesOrder.customer_id == customer_id)
    return paginate(
        db, stmt, params,
        sortable={
            "number": SalesOrder.number,
            "order_date": SalesOrder.order_date,
            "total": SalesOrder.total,
            "status": SalesOrder.status,
        },
        searchable=[SalesOrder.number, SalesOrder.reference],
        default_sort="-order_date",
    )


@orders.get("/{order_id}", response_model=SalesOrderOut)
def get_sales_order(
    order_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
):
    return svc.get_or_404(db, SalesOrder, order_id, "sales order")


@orders.post("", response_model=SalesOrderOut, status_code=status.HTTP_201_CREATED)
def create_sales_order(
    payload: SalesOrderCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    """Tax is never taken from the request.

    Each line's rate is snapshotted from its product and the amounts are computed
    server-side — the client mirrors the arithmetic for display only. A client
    and a server that disagree about tax disagree at the worst possible moment.
    """
    order = svc.create_sales_order(db, payload)
    db.commit()
    db.refresh(order)
    emit("sales_order.created", id=order.id, number=order.number)
    return order


@orders.patch("/{order_id}", response_model=SalesOrderOut)
def update_sales_order(
    order_id: str,
    payload: SalesOrderUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    order = svc.update_sales_order(db, order_id, payload)
    db.commit()
    db.refresh(order)
    return order


@orders.post("/{order_id}/confirm", response_model=SalesOrderOut)
def confirm_sales_order(
    order_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    order = svc.confirm_sales_order(db, order_id)
    db.commit()
    db.refresh(order)
    emit("sales_order.confirmed", id=order.id, number=order.number)
    return order


@orders.post(
    "/{order_id}/create-invoice",
    response_model=CustomerInvoiceOut,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice_from_order(
    order_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    invoice = svc.create_invoice_from_so(db, order_id)
    db.commit()
    db.refresh(invoice)
    emit(
        "customer_invoice.created",
        id=invoice.id, number=invoice.number, from_order=order_id,
    )
    return invoice


@orders.post("/{order_id}/cancel", response_model=SalesOrderOut)
def cancel_sales_order(
    order_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    order = svc.cancel_sales_order(db, order_id)
    db.commit()
    db.refresh(order)
    emit("sales_order.cancelled", id=order.id, number=order.number)
    return order


# ── Customer invoices ─────────────────────────────────────────────────────────


@invoices.get("", response_model=Page[CustomerInvoiceOut])
def list_customer_invoices(
    status_filter: CustomerInvoiceStatus | None = Query(None, alias="status"),
    customer_id: str | None = None,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    stmt = select(CustomerInvoice)
    if status_filter is not None:
        stmt = stmt.where(CustomerInvoice.status == status_filter)
    if customer_id is not None:
        stmt = stmt.where(CustomerInvoice.customer_id == customer_id)
    return paginate(
        db, stmt, params,
        sortable={
            "number": CustomerInvoice.number,
            "invoice_date": CustomerInvoice.invoice_date,
            "due_date": CustomerInvoice.due_date,
            "total": CustomerInvoice.total,
            "status": CustomerInvoice.status,
        },
        searchable=[CustomerInvoice.number, CustomerInvoice.reference],
        default_sort="-invoice_date",
    )


@invoices.get("/{invoice_id}", response_model=CustomerInvoiceOut)
def get_customer_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
):
    return svc.get_or_404(db, CustomerInvoice, invoice_id, "invoice")


@invoices.post(
    "", response_model=CustomerInvoiceOut, status_code=status.HTTP_201_CREATED
)
def create_customer_invoice(
    payload: CustomerInvoiceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    invoice = svc.create_customer_invoice(db, payload)
    db.commit()
    db.refresh(invoice)
    emit("customer_invoice.created", id=invoice.id, number=invoice.number)
    return invoice


@invoices.patch("/{invoice_id}", response_model=CustomerInvoiceOut)
def update_customer_invoice(
    invoice_id: str,
    payload: CustomerInvoiceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    invoice = svc.update_customer_invoice(db, invoice_id, payload)
    db.commit()
    db.refresh(invoice)
    return invoice


@invoices.post("/{invoice_id}/post", response_model=CustomerInvoiceOut)
def post_customer_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_txn_write),
):
    """Generate this invoice's journal entry — the moment it enters the books."""
    invoice = svc.post_customer_invoice(db, invoice_id, actor_id=user.id)
    db.commit()
    db.refresh(invoice)
    emit(
        "document.posted",
        type="customer_invoice", id=invoice.id, number=invoice.number,
        total=float(invoice.total),
    )
    emit_ledger_events(db)
    return invoice


@invoices.post("/{invoice_id}/cancel", response_model=CustomerInvoiceOut)
def cancel_customer_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    invoice = svc.cancel_customer_invoice(db, invoice_id, actor_id=user.id)
    db.commit()
    db.refresh(invoice)
    emit("customer_invoice.cancelled", id=invoice.id, number=invoice.number)
    emit_ledger_events(db)
    return invoice


router.include_router(orders)
router.include_router(invoices)
