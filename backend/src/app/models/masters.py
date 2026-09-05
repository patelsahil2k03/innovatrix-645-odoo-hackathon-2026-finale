import uuid

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, GUID, TimestampMixin, UUIDMixin
from .enums import AccountType, AnalyticType, BudgetState, ContactType, JournalType, ProductType


class ProductCategory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "product_categories"

    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)


class Account(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "accounts"

    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[AccountType] = mapped_column(
        SAEnum(AccountType, native_enum=False), index=True, nullable=False
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class Journal(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "journals"

    name: Mapped[str] = mapped_column(String(80), nullable=False)
    type: Mapped[JournalType] = mapped_column(
        SAEnum(JournalType, native_enum=False), index=True, nullable=False
    )
    default_debit_account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("accounts.id")
    )
    default_credit_account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("accounts.id")
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)


class Contact(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "contacts"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[ContactType] = mapped_column(
        SAEnum(ContactType, native_enum=False), index=True, nullable=False
    )
    email: Mapped[str | None] = mapped_column(String(180), unique=True)
    mobile: Mapped[str | None] = mapped_column(String(20))
    address_street: Mapped[str | None] = mapped_column(String(180))
    address_city: Mapped[str | None] = mapped_column(String(80))
    address_state: Mapped[str | None] = mapped_column(String(80))
    address_country: Mapped[str] = mapped_column(String(80), default="India")
    address_pincode: Mapped[str | None] = mapped_column(String(10))
    image_url: Mapped[str | None] = mapped_column(String(400))
    receivable_account_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("accounts.id")
    )
    payable_account_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("accounts.id"))
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    receivable_account: Mapped[Account | None] = relationship(foreign_keys=[receivable_account_id])
    payable_account: Mapped[Account | None] = relationship(foreign_keys=[payable_account_id])


class Product(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("sales_price >= 0", name="ck_product_sales_price_nonneg"),
        CheckConstraint("cost_price >= 0", name="ck_product_cost_price_nonneg"),
        CheckConstraint(
            "sales_tax_pct >= 0 AND sales_tax_pct <= 100", name="ck_product_tax_pct_range"
        ),
    )

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    type: Mapped[ProductType] = mapped_column(SAEnum(ProductType, native_enum=False), nullable=False)
    sales_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    cost_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("product_categories.id"), index=True
    )
    sales_tax_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    income_account_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("accounts.id"))
    expense_account_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("accounts.id"))
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)

    category: Mapped[ProductCategory | None] = relationship()
    income_account: Mapped[Account | None] = relationship(foreign_keys=[income_account_id])
    expense_account: Mapped[Account | None] = relationship(foreign_keys=[expense_account_id])


class AnalyticAccount(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "analytic_accounts"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[AnalyticType] = mapped_column(
        SAEnum(AnalyticType, native_enum=False), nullable=False
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)


class Budget(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "budgets"
    __table_args__ = (
        CheckConstraint("period_end > period_start", name="ck_budget_period_order"),
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    period_start: Mapped[str] = mapped_column(Date, nullable=False)
    period_end: Mapped[str] = mapped_column(Date, nullable=False)
    responsible_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("contacts.id"))
    state: Mapped[BudgetState] = mapped_column(
        SAEnum(BudgetState, native_enum=False), index=True, default=BudgetState.DRAFT
    )
    revision_of_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("budgets.id"))
    revised_with_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("budgets.id"))

    lines: Mapped[list["BudgetLine"]] = relationship(back_populates="budget")


class BudgetLine(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "budget_lines"
    __table_args__ = (
        UniqueConstraint("budget_id", "analytic_account_id", name="uq_budget_line_analytic"),
        CheckConstraint("committed_amount >= 0", name="ck_budget_line_committed_nonneg"),
    )

    budget_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("budgets.id"), index=True)
    analytic_account_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("analytic_accounts.id"), index=True
    )
    committed_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    budget: Mapped[Budget] = relationship(back_populates="lines")
    analytic_account: Mapped[AnalyticAccount] = relationship()
