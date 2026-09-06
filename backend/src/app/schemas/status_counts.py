"""Response shape for `GET /status-counts` (04_API_CONTRACT.md §4.1).

Read-only — nothing here is ever accepted as input.
"""

from pydantic import BaseModel, Field


class ModuleCounts(BaseModel):
    total: int
    by_status: dict[str, int] = Field(
        description="Every state the module defines, including the ones at zero."
    )


class StatusCountsOut(BaseModel):
    modules: dict[str, ModuleCounts] = Field(
        description="Keyed by module: sales_orders, customer_invoices, "
        "purchase_orders, vendor_bills, budgets."
    )
