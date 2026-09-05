"""The purchase chain (04_API_CONTRACT.md §3.2).

    Purchase Order  DRAFT -> CONFIRMED -> BILLED -> (CANCELLED)
    Vendor Bill     DRAFT -> POSTED -> PARTIAL -> PAID -> (CANCELLED)

Routers stay thin on purpose: they authenticate, validate the request shape,
call one service function, commit, and emit. Every rule about *when* a
transition is legal lives in `services/documents.py`, so the background
simulator and the API cannot disagree about them.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PageParams, page_params, paginate
from app.core.rbac import require_admin, require_internal, require_txn_write
from app.models.auth import User
from app.models.documents import (
    PurchaseOrder,
    PurchaseOrderStatus,
    VendorBill,
    VendorBillStatus,
)
from app.schemas.common import Page
from app.schemas.documents import (
    PurchaseOrderCreate,
    PurchaseOrderOut,
    PurchaseOrderUpdate,
    VendorBillCreate,
    VendorBillOut,
    VendorBillUpdate,
)
from app.services import documents as svc
from app.services.notify import emit_ledger_events
from app.services.rules import emit

router = APIRouter()

orders = APIRouter(prefix="/purchase-orders", tags=["purchase"])
bills = APIRouter(prefix="/vendor-bills", tags=["purchase"])


# ── Purchase orders ───────────────────────────────────────────────────────────


@orders.get("", response_model=Page[PurchaseOrderOut])
def list_purchase_orders(
    status_filter: PurchaseOrderStatus | None = Query(None, alias="status"),
    vendor_id: str | None = None,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    stmt = select(PurchaseOrder)
    if status_filter is not None:
        stmt = stmt.where(PurchaseOrder.status == status_filter)
    if vendor_id is not None:
        stmt = stmt.where(PurchaseOrder.vendor_id == vendor_id)
    return paginate(
        db, stmt, params,
        sortable={
            "number": PurchaseOrder.number,
            "order_date": PurchaseOrder.order_date,
            "total": PurchaseOrder.total,
            "status": PurchaseOrder.status,
        },
        searchable=[PurchaseOrder.number, PurchaseOrder.reference],
        default_sort="-order_date",
    )


@orders.get("/{order_id}", response_model=PurchaseOrderOut)
def get_purchase_order(
    order_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
):
    return svc.get_or_404(db, PurchaseOrder, order_id, "purchase order")


@orders.post("", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    order = svc.create_purchase_order(db, payload)
    db.commit()
    db.refresh(order)
    emit("purchase_order.created", id=order.id, number=order.number)
    return order


@orders.patch("/{order_id}", response_model=PurchaseOrderOut)
def update_purchase_order(
    order_id: str,
    payload: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    order = svc.update_purchase_order(db, order_id, payload)
    db.commit()
    db.refresh(order)
    return order


@orders.post("/{order_id}/confirm", response_model=PurchaseOrderOut)
def confirm_purchase_order(
    order_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    order = svc.confirm_purchase_order(db, order_id)
    db.commit()
    db.refresh(order)
    emit("purchase_order.confirmed", id=order.id, number=order.number)
    return order


@orders.post(
    "/{order_id}/create-bill",
    response_model=VendorBillOut,
    status_code=status.HTTP_201_CREATED,
)
def create_bill_from_order(
    order_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    """Convert a confirmed order into a draft bill and mark the order BILLED.

    The bill is created in DRAFT, not posted: converting is a clerical step, and
    posting is the accounting one. They are separate buttons because they are
    separate decisions.
    """
    bill = svc.create_bill_from_po(db, order_id)
    db.commit()
    db.refresh(bill)
    emit("vendor_bill.created", id=bill.id, number=bill.number, from_order=order_id)
    return bill


@orders.post("/{order_id}/cancel", response_model=PurchaseOrderOut)
def cancel_purchase_order(
    order_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    order = svc.cancel_purchase_order(db, order_id)
    db.commit()
    db.refresh(order)
    emit("purchase_order.cancelled", id=order.id, number=order.number)
    return order


# ── Vendor bills ──────────────────────────────────────────────────────────────


@bills.get("", response_model=Page[VendorBillOut])
def list_vendor_bills(
    status_filter: VendorBillStatus | None = Query(None, alias="status"),
    vendor_id: str | None = None,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
) -> dict:
    stmt = select(VendorBill)
    if status_filter is not None:
        stmt = stmt.where(VendorBill.status == status_filter)
    if vendor_id is not None:
        stmt = stmt.where(VendorBill.vendor_id == vendor_id)
    return paginate(
        db, stmt, params,
        sortable={
            "number": VendorBill.number,
            "bill_date": VendorBill.bill_date,
            "due_date": VendorBill.due_date,
            "total": VendorBill.total,
            "status": VendorBill.status,
        },
        searchable=[VendorBill.number, VendorBill.reference],
        default_sort="-bill_date",
    )


@bills.get("/{bill_id}", response_model=VendorBillOut)
def get_vendor_bill(
    bill_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_internal),
):
    return svc.get_or_404(db, VendorBill, bill_id, "vendor bill")


@bills.post("", response_model=VendorBillOut, status_code=status.HTTP_201_CREATED)
def create_vendor_bill(
    payload: VendorBillCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    """A bill can be raised with no purchase order behind it — `po_id` is
    nullable, and the UI hides the back-link when there is none."""
    bill = svc.create_vendor_bill(db, payload)
    db.commit()
    db.refresh(bill)
    emit("vendor_bill.created", id=bill.id, number=bill.number)
    return bill


@bills.patch("/{bill_id}", response_model=VendorBillOut)
def update_vendor_bill(
    bill_id: str,
    payload: VendorBillUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_txn_write),
):
    bill = svc.update_vendor_bill(db, bill_id, payload)
    db.commit()
    db.refresh(bill)
    return bill


@bills.post("/{bill_id}/post", response_model=VendorBillOut)
def post_vendor_bill(
    bill_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_txn_write),
):
    """Generate this bill's journal entry. Idempotent — a second call is 409."""
    bill = svc.post_vendor_bill(db, bill_id, actor_id=user.id)
    db.commit()
    db.refresh(bill)
    emit(
        "document.posted",
        type="vendor_bill", id=bill.id, number=bill.number, total=float(bill.total),
    )
    emit_ledger_events(db)
    return bill


@bills.post("/{bill_id}/cancel", response_model=VendorBillOut)
def cancel_vendor_bill(
    bill_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Admin only, and it reverses rather than deletes: a posted bill's entry is
    mirrored by a reversing entry, leaving both in the ledger."""
    bill = svc.cancel_vendor_bill(db, bill_id, actor_id=user.id)
    db.commit()
    db.refresh(bill)
    emit("vendor_bill.cancelled", id=bill.id, number=bill.number)
    emit_ledger_events(db)
    return bill


router.include_router(orders)
router.include_router(bills)
