"""Request and response shapes for the six master-data modules.

All six behave identically by design (docs/04_API_CONTRACT.md §3.1): list, detail,
create, patch, archive. Each gets a `Create`, an `Update` and an `Out` — the
`Update` exists separately because PATCH is Admin-only and every field on it is
optional, which a shared model cannot express without making creation permissive.
"""

from pydantic import AliasPath, BaseModel, EmailStr, Field

from app.models.masters import (
    AccountType,
    AnalyticType,
    ContactType,
    JournalType,
    ProductType,
)
from app.schemas.common import Money, ORMModel

# ── Contacts ──────────────────────────────────────────────────────────────────


class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: ContactType
    email: EmailStr | None = None
    mobile: str | None = Field(default=None, max_length=20)
    address_street: str | None = Field(default=None, max_length=180)
    address_city: str | None = Field(default=None, max_length=80)
    address_state: str | None = Field(default=None, max_length=80)
    address_country: str = Field(default="India", max_length=80)
    address_pincode: str | None = Field(default=None, max_length=10)
    image_url: str | None = Field(default=None, max_length=400)
    receivable_account_id: str | None = None
    payable_account_id: str | None = None


class ContactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: ContactType | None = None
    email: EmailStr | None = None
    mobile: str | None = Field(default=None, max_length=20)
    address_street: str | None = Field(default=None, max_length=180)
    address_city: str | None = Field(default=None, max_length=80)
    address_state: str | None = Field(default=None, max_length=80)
    address_country: str | None = Field(default=None, max_length=80)
    address_pincode: str | None = Field(default=None, max_length=10)
    image_url: str | None = Field(default=None, max_length=400)
    receivable_account_id: str | None = None
    payable_account_id: str | None = None


class ContactOut(ORMModel):
    id: str
    name: str
    type: ContactType
    email: str | None
    mobile: str | None
    address_street: str | None
    address_city: str | None
    address_state: str | None
    address_country: str
    address_pincode: str | None
    image_url: str | None
    receivable_account_id: str | None
    payable_account_id: str | None
    is_archived: bool


# ── Product categories ────────────────────────────────────────────────────────


class ProductCategoryCreate(BaseModel):
    """The product form's combobox posts a bare {"name": "..."} to create a
    category inline, so `name` is the only field there is."""

    name: str = Field(min_length=1, max_length=80)


class ProductCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)


class ProductCategoryOut(ORMModel):
    id: str
    name: str
    is_archived: bool


# ── Products ──────────────────────────────────────────────────────────────────


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    type: ProductType
    sales_price: Money = Field(ge=0)
    cost_price: Money = Field(ge=0)
    category_id: str | None = None
    sales_tax_pct: Money = Field(default=0, ge=0, le=100)
    income_account_id: str | None = None
    expense_account_id: str | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    type: ProductType | None = None
    sales_price: Money | None = Field(default=None, ge=0)
    cost_price: Money | None = Field(default=None, ge=0)
    category_id: str | None = None
    sales_tax_pct: Money | None = Field(default=None, ge=0, le=100)
    income_account_id: str | None = None
    expense_account_id: str | None = None


class ProductOut(ORMModel):
    id: str
    name: str
    type: ProductType
    sales_price: Money
    cost_price: Money
    category_id: str | None
    category_name: str | None = Field(
        default=None, validation_alias=AliasPath("category", "name")
    )
    sales_tax_pct: Money
    income_account_id: str | None
    expense_account_id: str | None
    is_archived: bool


# ── Chart of accounts ─────────────────────────────────────────────────────────


class AccountCreate(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=120)
    type: AccountType


class AccountUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=20)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: AccountType | None = None


class AccountOut(ORMModel):
    id: str
    code: str
    name: str
    type: AccountType
    is_archived: bool


# ── Journals ──────────────────────────────────────────────────────────────────


class JournalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    type: JournalType
    default_debit_account_id: str | None = None
    default_credit_account_id: str | None = None


class JournalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    type: JournalType | None = None
    default_debit_account_id: str | None = None
    default_credit_account_id: str | None = None


class JournalOut(ORMModel):
    id: str
    name: str
    type: JournalType
    default_debit_account_id: str | None
    default_credit_account_id: str | None
    is_archived: bool


# ── Analytic accounts ─────────────────────────────────────────────────────────


class AnalyticAccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: AnalyticType


class AnalyticAccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: AnalyticType | None = None


class AnalyticAccountOut(ORMModel):
    id: str
    name: str
    type: AnalyticType
    is_archived: bool
