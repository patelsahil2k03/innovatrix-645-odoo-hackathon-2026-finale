"""Import every model here so Alembic autogenerate and Base.metadata see them all."""

from app.models.auth import Role, User
from app.models.base import Base
from app.models.budgets import Budget, BudgetLine
from app.models.documents import (
    CustomerInvoice,
    CustomerInvoiceLine,
    PurchaseOrder,
    PurchaseOrderLine,
    SalesOrder,
    SalesOrderLine,
    VendorBill,
    VendorBillLine,
)
from app.models.ledger import JournalEntry, JournalLine, NumberSequence
from app.models.masters import (
    Account,
    AnalyticAccount,
    Contact,
    Journal,
    Product,
    ProductCategory,
)
from app.models.payments import Payment
from app.models.system import AuditLog, Notification

__all__ = [
    "Base",
    "Role",
    "User",
    "AuditLog",
    "Notification",
    "Contact",
    "Product",
    "ProductCategory",
    "Account",
    "Journal",
    "AnalyticAccount",
    "NumberSequence",
    "JournalEntry",
    "JournalLine",
    "PurchaseOrder",
    "PurchaseOrderLine",
    "VendorBill",
    "VendorBillLine",
    "SalesOrder",
    "SalesOrderLine",
    "CustomerInvoice",
    "CustomerInvoiceLine",
    "Payment",
    "Budget",
    "BudgetLine",
]
