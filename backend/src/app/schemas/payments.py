"""Payment request and response shapes (docs/04_API_CONTRACT.md §3.4).

Exactly one of `invoice_id` / `bill_id` — enforced here so a malformed request is
a 422 with a field message rather than a database CHECK violation surfacing as a
500. The same rule exists as a CHECK constraint in the model; this is the polite
layer in front of it, not a replacement for it.
"""

from datetime import date

from pydantic import AliasPath, BaseModel, Field, model_validator

from app.models.payments import PaymentDirection
from app.schemas.common import Money, ORMModel


class PaymentCreate(BaseModel):
    direction: PaymentDirection
    journal_id: str
    amount: Money = Field(gt=0)
    invoice_id: str | None = None
    bill_id: str | None = None
    payment_date: date | None = None
    note: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _exactly_one_target(self) -> "PaymentCreate":
        if (self.invoice_id is None) == (self.bill_id is None):
            raise ValueError(
                "Provide exactly one of invoice_id or bill_id — a payment settles "
                "one document."
            )
        return self


class PortalPaymentCreate(BaseModel):
    """The portal's own payment body.

    A contact never chooses a direction: paying their own invoice is always
    RECEIVE, and settling a bill they issued is always SEND, so the server
    derives it. The journal is optional and defaults to Bank.
    """

    amount: Money = Field(gt=0)
    invoice_id: str | None = None
    bill_id: str | None = None
    journal_id: str | None = None
    payment_date: date | None = None
    note: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _exactly_one_target(self) -> "PortalPaymentCreate":
        if (self.invoice_id is None) == (self.bill_id is None):
            raise ValueError("Provide exactly one of invoice_id or bill_id.")
        return self


class PaymentOut(ORMModel):
    id: str
    number: str
    contact_id: str
    contact_name: str | None = Field(
        default=None, validation_alias=AliasPath("contact", "name")
    )
    direction: PaymentDirection
    journal_id: str
    journal_name: str | None = Field(
        default=None, validation_alias=AliasPath("journal", "name")
    )
    amount: Money
    payment_date: date
    note: str | None
    invoice_id: str | None
    bill_id: str | None
    journal_entry_id: str | None
