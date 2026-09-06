"""How many documents sit in each state, per module.

The mockup puts "Confirmed 10 / Draft 2" beside every module heading
(`docs/PROBLEM_STATEMENT.md` §4 item 14), which is a question about *documents*,
not about the ledger — so unlike `services/reports.py` and
`services/analytics.py` this file counts document rows on purpose. A cancelled
sales order is still a sales order in the CANCELLED column; that is exactly what
the count is for, and it is why the `brain/RULES.md` §3 rule ("reports aggregate
journal lines") does not apply here. Nothing in this file reads or reports money.

One `GROUP BY` per module against an indexed enum column, so the whole payload
is five small aggregate queries rather than five list scans counted in Python.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.budgets import Budget, BudgetState
from app.models.documents import (
    CustomerInvoice,
    CustomerInvoiceStatus,
    PurchaseOrder,
    PurchaseOrderStatus,
    SalesOrder,
    SalesOrderStatus,
    VendorBill,
    VendorBillStatus,
)

# Module key → (model, status column, the enum whose members define the columns).
#
# The enum is listed explicitly rather than derived from whatever rows happen to
# exist, so a state with zero documents still renders as "0" instead of silently
# vanishing from the UI. A missing column reads as "this state is impossible";
# a zero reads as "nothing is there yet", and only the second one is true.
_MODULES = {
    "sales_orders": (SalesOrder, SalesOrder.status, SalesOrderStatus),
    "customer_invoices": (CustomerInvoice, CustomerInvoice.status, CustomerInvoiceStatus),
    "purchase_orders": (PurchaseOrder, PurchaseOrder.status, PurchaseOrderStatus),
    "vendor_bills": (VendorBill, VendorBill.status, VendorBillStatus),
    "budgets": (Budget, Budget.state, BudgetState),
}


def status_counts(db: Session) -> dict[str, dict]:
    """`{module: {"total": n, "by_status": {STATE: n}}}` for every module."""
    out: dict[str, dict] = {}

    for key, (model, column, enum_cls) in _MODULES.items():
        rows = db.execute(
            select(column, func.count(model.id)).group_by(column)
        ).all()

        # Seed every state at zero first, then overlay what the query found.
        by_status = {member.value: 0 for member in enum_cls}
        for state, count in rows:
            # SQLAlchemy hands back the enum member for an Enum column and a
            # plain string for a native one, depending on the backend. Take the
            # value either way rather than trusting one shape.
            by_status[getattr(state, "value", state)] = count

        out[key] = {"total": sum(by_status.values()), "by_status": by_status}

    return out
