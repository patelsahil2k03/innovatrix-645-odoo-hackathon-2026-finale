"""Master data: contacts, products, chart of accounts, journals, analytic accounts.

See docs/03_DATA_MODEL.md §2. These are the tables every document and posting
references — nothing here has a state machine of its own, and nothing here is ever
hard-deleted. `is_archived` blocks new use; it never touches history (§6).
"""

import enum

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class ContactType(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    VENDOR = "VENDOR"
    BOTH = "BOTH"


class ProductType(str, enum.Enum):
    GOODS = "GOODS"
    SERVICE = "SERVICE"
    COMBO = "COMBO"


class AccountType(str, enum.Enum):
    """Eight values, taken from the mockup rather than the PDF's five.

    BANK and CASH are their own types (not named accounts under ASSET) — that is
    what lets the Balance Sheet list them separately without hard-coding account
    names. OTHER_EXPENSE is distinct from EXPENSE because the P&L reports them on
    separate lines. "Capital" is stored as CAPITAL, matching the mockup's own word.
    """

    ASSET = "ASSET"
    BANK = "BANK"
    CASH = "CASH"
    LIABILITY = "LIABILITY"
    CAPITAL = "CAPITAL"
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    OTHER_EXPENSE = "OTHER_EXPENSE"


DEBIT_POSITIVE_TYPES = {
    AccountType.ASSET,
    AccountType.BANK,
    AccountType.CASH,
    AccountType.EXPENSE,
    AccountType.OTHER_EXPENSE,
}
"""Normal balance is derived from type, never stored (03_DATA_MODEL.md §2)."""


class JournalType(str, enum.Enum):
    SALES = "SALES"
    PURCHASE = "PURCHASE"
    BANK = "BANK"
    CASH = "CASH"
    MISC = "MISC"


class AnalyticType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"


class Contact(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "contacts"
    __table_args__ = (
        # Backs the "name" sort/search — the default and by far the most common
        # way this list is browsed and filtered — plus the "newest first" sort.
        Index("ix_contacts_name", "name"),
        Index("ix_contacts_created_at", "created_at"),
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[ContactType] = mapped_column(
        SAEnum(ContactType, native_enum=False), nullable=False, index=True
    )
    # Nullable + unique: NULL is treated as distinct from every other NULL by a
    # unique index on both SQLite and PostgreSQL, so multiple contacts with no
    # email is fine — only a duplicate real email is rejected.
    email: Mapped[str | None] = mapped_column(String(180), unique=True)
    mobile: Mapped[str | None] = mapped_column(String(20))
    address_street: Mapped[str | None] = mapped_column(String(180))
    address_city: Mapped[str | None] = mapped_column(String(80))
    address_state: Mapped[str | None] = mapped_column(String(80))
    address_country: Mapped[str] = mapped_column(String(80), default="India", nullable=False)
    address_pincode: Mapped[str | None] = mapped_column(String(10))
    image_url: Mapped[str | None] = mapped_column(String(400))

    receivable_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))
    payable_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))

    is_archived: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<Contact {self.name}>"


class ProductCategory(UUIDMixin, Base):
    """A table, not a string column — creatable inline from the product form."""

    __tablename__ = "product_categories"

    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    is_archived: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)


class Product(UUIDMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("sales_price >= 0", name="ck_products_sales_price_nonneg"),
        CheckConstraint("cost_price >= 0", name="ck_products_cost_price_nonneg"),
        CheckConstraint(
            "sales_tax_pct >= 0 AND sales_tax_pct <= 100", name="ck_products_tax_pct_range"
        ),
        # All three are in the sort allowlist (04_API_CONTRACT.md §3.1).
        Index("ix_products_name", "name"),
        Index("ix_products_sales_price", "sales_price"),
        Index("ix_products_cost_price", "cost_price"),
    )

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    type: Mapped[ProductType] = mapped_column(
        SAEnum(ProductType, native_enum=False), nullable=False, index=True
    )
    sales_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    cost_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    category_id: Mapped[str | None] = mapped_column(
        ForeignKey("product_categories.id"), index=True
    )
    category: Mapped[ProductCategory | None] = relationship(lazy="joined")
    sales_tax_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)

    income_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))
    expense_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))

    is_archived: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<Product {self.name}>"


class Account(UUIDMixin, Base):
    """The Chart of Accounts. Seeded once (03_DATA_MODEL.md §8) — the mockup itself
    says these are "to be pre configured", not invented by the user on the fly."""

    __tablename__ = "accounts"

    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[AccountType] = mapped_column(
        SAEnum(AccountType, native_enum=False), nullable=False, index=True
    )
    is_archived: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)

    @property
    def is_debit_positive(self) -> bool:
        """Derived, never stored — see DEBIT_POSITIVE_TYPES above."""
        return self.type in DEBIT_POSITIVE_TYPES

    def __repr__(self) -> str:
        return f"<Account {self.code} {self.name}>"


class Journal(UUIDMixin, Base):
    __tablename__ = "journals"

    name: Mapped[str] = mapped_column(String(80), nullable=False)
    type: Mapped[JournalType] = mapped_column(
        SAEnum(JournalType, native_enum=False), nullable=False, index=True
    )
    default_debit_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))
    default_credit_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))
    is_archived: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<Journal {self.name}>"


class AnalyticAccount(UUIDMixin, Base):
    """A reporting dimension, not a ledger account (03_DATA_MODEL.md §2). Tags
    document lines — never journal lines — so a budget can be measured without
    distorting the Chart of Accounts."""

    __tablename__ = "analytic_accounts"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[AnalyticType] = mapped_column(
        SAEnum(AnalyticType, native_enum=False), nullable=False, index=True
    )
    is_archived: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<AnalyticAccount {self.name}>"
