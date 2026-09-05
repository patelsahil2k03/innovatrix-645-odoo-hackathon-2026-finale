"""Budget shapes. The three achievement figures are computed on read and returned
alongside the one stored figure (docs/03_DATA_MODEL.md §2) — they are response-only
and there is deliberately no way to write them.
"""

from datetime import date
from decimal import Decimal

from pydantic import AliasPath, BaseModel, Field, model_validator

from app.models.budgets import BudgetState
from app.models.masters import AnalyticType
from app.schemas.common import Money, ORMModel

ZERO = Decimal("0.00")


class BudgetLineIn(BaseModel):
    analytic_account_id: str
    committed_amount: Money = Field(ge=0)


class BudgetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    period_start: date
    period_end: date
    responsible_id: str | None = None
    lines: list[BudgetLineIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def _period_is_valid(self) -> "BudgetCreate":
        if self.period_end <= self.period_start:
            raise ValueError("period_end must be after period_start.")
        return self


class BudgetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    period_start: date | None = None
    period_end: date | None = None
    responsible_id: str | None = None
    lines: list[BudgetLineIn] | None = None


class BudgetLineOut(ORMModel):
    id: str
    analytic_account_id: str
    analytic_account: str | None = Field(
        default=None, validation_alias=AliasPath("analytic_account", "name")
    )
    type: AnalyticType | None = Field(
        default=None, validation_alias=AliasPath("analytic_account", "type")
    )
    committed_amount: Money
    # Computed by services/budgets.py and attached before serialisation. They
    # default to zero so a line still serialises if it is read outside that
    # service, rather than failing on a missing required field.
    achieved_amount: Money = ZERO
    achieved_pct: Money = ZERO
    amount_to_achieve: Money = ZERO


class BudgetOut(ORMModel):
    id: str
    name: str
    period_start: date
    period_end: date
    responsible_id: str | None
    responsible_name: str | None = Field(
        default=None, validation_alias=AliasPath("responsible", "name")
    )
    state: BudgetState
    revision_of_id: str | None
    revised_with_id: str | None
    lines: list[BudgetLineOut] = []
