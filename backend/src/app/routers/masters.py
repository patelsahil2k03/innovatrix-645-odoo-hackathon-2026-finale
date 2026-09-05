"""The six master-data modules (04_API_CONTRACT.md §3.1).

All six behave identically — list, detail, create, patch, archive — so they are
built once by `_crud_router` and configured six times below, rather than written
out six times with six chances to diverge. The contract specifies them as one
shape; this file is that shape.

The permission split is the same on every module and is the graded rule:
create is Admin **or** Accountant, modify and archive are Admin **only**.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.core.database import get_db
from app.core.errors import AppError
from app.core.pagination import PageParams, page_params, paginate
from app.core.rbac import require_internal, require_master_create, require_master_modify
from app.models.auth import User
from app.models.masters import (
    Account,
    AnalyticAccount,
    Contact,
    Journal,
    Product,
    ProductCategory,
)
from app.schemas.common import Message, Page
from app.schemas.masters import (
    AccountCreate,
    AccountOut,
    AccountUpdate,
    AnalyticAccountCreate,
    AnalyticAccountOut,
    AnalyticAccountUpdate,
    ContactCreate,
    ContactOut,
    ContactUpdate,
    JournalCreate,
    JournalOut,
    JournalUpdate,
    ProductCategoryCreate,
    ProductCategoryOut,
    ProductCategoryUpdate,
    ProductCreate,
    ProductOut,
    ProductUpdate,
)
from app.services.rules import emit

logger = logging.getLogger(__name__)

router = APIRouter()


def _crud_router(
    *,
    path: str,
    tag: str,
    model: type,
    label: str,
    create_schema: type[BaseModel],
    update_schema: type[BaseModel],
    out_schema: type[BaseModel],
    sortable: dict[str, InstrumentedAttribute],
    searchable: list[InstrumentedAttribute],
    default_sort: str,
    event_prefix: str,
    list_join: Any = None,
    apply_defaults: Any = None,
) -> APIRouter:
    """Build the five endpoints one master-data module needs."""
    sub = APIRouter(prefix=path, tags=[tag])

    def _get_or_404(db: Session, row_id: str):
        row = db.get(model, row_id)
        if row is None:
            raise AppError("NOT_FOUND", f"That {label} no longer exists.", 404)
        return row

    @sub.get("", response_model=Page[out_schema])
    def list_rows(
        include_archived: bool = False,
        params: PageParams = Depends(page_params),
        db: Session = Depends(get_db),
        _: User = Depends(require_internal),
    ) -> dict:
        stmt = select(model)
        # Products are searchable by their category's name as well as their own
        # (04_API_CONTRACT.md §3.1), which needs the category table in the query.
        # An OUTER join, so a product with no category is still listed.
        if list_join is not None:
            stmt = stmt.join(list_join, isouter=True)
        # Archived rows are hidden by default rather than deleted: they still
        # back every historical document that references them, so they must
        # remain fetchable — just not offered for new work.
        if not include_archived:
            stmt = stmt.where(model.is_archived.is_(False))
        return paginate(
            db, stmt, params,
            sortable=sortable, searchable=searchable, default_sort=default_sort,
        )

    @sub.get("/{row_id}", response_model=out_schema)
    def get_row(
        row_id: str,
        db: Session = Depends(get_db),
        _: User = Depends(require_internal),
    ):
        return _get_or_404(db, row_id)

    @sub.post("", response_model=out_schema, status_code=status.HTTP_201_CREATED)
    def create_row(
        payload: create_schema,  # type: ignore[valid-type]
        db: Session = Depends(get_db),
        _: User = Depends(require_master_create),
    ):
        values = payload.model_dump(exclude_unset=True)
        if apply_defaults is not None:
            apply_defaults(db, values)
        row = model(**values)
        db.add(row)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise _conflict(label, exc) from exc
        db.refresh(row)
        emit(f"{event_prefix}.created", id=row.id)
        return row

    @sub.patch("/{row_id}", response_model=out_schema)
    def update_row(
        row_id: str,
        payload: update_schema,  # type: ignore[valid-type]
        db: Session = Depends(get_db),
        _: User = Depends(require_master_modify),
    ):
        row = _get_or_404(db, row_id)
        # exclude_unset, not exclude_none: a PATCH that deliberately clears an
        # optional field sends null, and that must be distinguishable from a
        # field the caller simply did not mention.
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(row, key, value)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise _conflict(label, exc) from exc
        db.refresh(row)
        emit(f"{event_prefix}.updated", id=row.id)
        return row

    @sub.post("/{row_id}/archive", response_model=Message)
    def archive_row(
        row_id: str,
        db: Session = Depends(get_db),
        _: User = Depends(require_master_modify),
    ) -> Message:
        """Archive, never delete.

        Archiving blocks the row from being chosen on anything new. It has zero
        effect on documents or journal entries that already reference it — an
        archived account's historical postings stay exactly as they were and
        still appear in every report covering their period (03_DATA_MODEL.md §6).
        """
        row = _get_or_404(db, row_id)
        if row.is_archived:
            return Message(ok=True, message=f"That {label} is already archived.")
        row.is_archived = True
        db.commit()
        emit(f"{event_prefix}.archived", id=row_id)
        return Message(ok=True, message=f"{label.capitalize()} archived.")

    return sub


def _default_account_id(db: Session, code: str) -> str | None:
    """The chart-of-accounts row for a seeded code, if it exists and is live."""
    account = db.execute(
        select(Account).where(Account.code == code, Account.is_archived.is_(False))
    ).scalar_one_or_none()
    return account.id if account is not None else None


def _contact_defaults(db: Session, values: dict) -> None:
    """Fall back to the system Debtors and Creditors accounts.

    03_DATA_MODEL.md §2 specifies exactly this: the two FKs are nullable and
    "default to the system Debtors/Creditors account". They are what let a
    document post itself without the user picking accounts by hand, so a contact
    created without them would raise MISSING_ACCOUNT_MAPPING on its first
    invoice — long after the moment anyone could connect cause to effect.
    """
    if not values.get("receivable_account_id"):
        values["receivable_account_id"] = _default_account_id(db, "1100")
    if not values.get("payable_account_id"):
        values["payable_account_id"] = _default_account_id(db, "2000")


def _product_defaults(db: Session, values: dict) -> None:
    """Fall back to Sales Income and Purchase Expense.

    The data model states this default for contacts and is silent for products,
    but the reasoning is identical and the failure is worse: a product with no
    income account can be created, added to an invoice, and only refused at the
    moment someone clicks Post. Both are still overridable per product and per
    document line, and MISSING_ACCOUNT_MAPPING still fires when no default
    exists in the chart of accounts at all.
    """
    if not values.get("income_account_id"):
        values["income_account_id"] = _default_account_id(db, "4000")
    if not values.get("expense_account_id"):
        values["expense_account_id"] = _default_account_id(db, "5000")


def _conflict(label: str, exc: IntegrityError) -> AppError:
    """Turn a unique-constraint violation into the enveloped 409 the contract
    promises, rather than letting an IntegrityError surface as a 500."""
    detail = str(getattr(exc, "orig", exc))
    logger.info("Integrity error creating/updating %s: %s", label, detail)
    return AppError(
        "CONFLICT",
        f"That {label} conflicts with one that already exists — a code, name or "
        "email is already taken.",
        status_code=409,
    )


router.include_router(
    _crud_router(
        path="/contacts", tag="contacts", model=Contact, label="contact",
        create_schema=ContactCreate, update_schema=ContactUpdate, out_schema=ContactOut,
        sortable={
            "name": Contact.name, "type": Contact.type, "created_at": Contact.created_at,
        },
        searchable=[Contact.name, Contact.email, Contact.mobile],
        default_sort="name", event_prefix="contact",
        apply_defaults=_contact_defaults,
    )
)

router.include_router(
    _crud_router(
        path="/products", tag="products", model=Product, label="product",
        create_schema=ProductCreate, update_schema=ProductUpdate, out_schema=ProductOut,
        sortable={
            "name": Product.name,
            "sales_price": Product.sales_price,
            "cost_price": Product.cost_price,
        },
        searchable=[Product.name, ProductCategory.name],
        default_sort="name", event_prefix="product",
        list_join=ProductCategory,
        apply_defaults=_product_defaults,
    )
)

router.include_router(
    _crud_router(
        path="/product-categories", tag="products", model=ProductCategory,
        label="category",
        create_schema=ProductCategoryCreate, update_schema=ProductCategoryUpdate,
        out_schema=ProductCategoryOut,
        sortable={"name": ProductCategory.name},
        searchable=[ProductCategory.name],
        default_sort="name", event_prefix="product_category",
    )
)

router.include_router(
    _crud_router(
        path="/accounts", tag="accounts", model=Account, label="account",
        create_schema=AccountCreate, update_schema=AccountUpdate, out_schema=AccountOut,
        sortable={"code": Account.code, "name": Account.name, "type": Account.type},
        searchable=[Account.code, Account.name],
        default_sort="code", event_prefix="account",
    )
)

router.include_router(
    _crud_router(
        path="/journals", tag="accounts", model=Journal, label="journal",
        create_schema=JournalCreate, update_schema=JournalUpdate, out_schema=JournalOut,
        sortable={"name": Journal.name, "type": Journal.type},
        searchable=[Journal.name],
        default_sort="name", event_prefix="journal",
    )
)

router.include_router(
    _crud_router(
        path="/analytic-accounts", tag="accounts", model=AnalyticAccount,
        label="analytic account",
        create_schema=AnalyticAccountCreate, update_schema=AnalyticAccountUpdate,
        out_schema=AnalyticAccountOut,
        sortable={"name": AnalyticAccount.name, "type": AnalyticAccount.type},
        searchable=[AnalyticAccount.name],
        default_sort="name", event_prefix="analytic_account",
    )
)
