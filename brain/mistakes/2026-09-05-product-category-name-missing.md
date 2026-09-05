### What happened
`http://localhost:3000/account/products` — the "Category" column was always blank
(showing "—"). Same for the product's Kanban-view subtitle.

### Why
`backend/src/app/schemas/masters.py`'s `ProductOut` never had a `category_name` field —
only `category_id`. The `Product` ORM model (`backend/src/app/models/masters.py`) had the
`category_id` foreign key column but no `category` relationship to traverse. The frontend
(`frontend/src/lib/api.ts`'s `Product` interface, and `account/products/page.tsx`) always
expected `product.category_name`, so the field silently came back `undefined` and every
row fell through to `?? "—"`.

The codebase already had the right pattern for exactly this — `PurchaseOrderOut`/
`VendorBillOut` in `schemas/documents.py` populate `vendor_name` via
`Field(default=None, validation_alias=AliasPath("vendor", "name"))`, reading a
`relationship(lazy="joined")` on the model. Products just never got the same treatment
when the category feature was built — a smaller-scope version of
[[2026-09-05-fe-be-report-contract-drift]] (frontend built against a shape the backend
never actually produced).

### Fix
Added `category: Mapped[ProductCategory | None] = relationship(lazy="joined")` to
`Product` (`models/masters.py`) and `category_name: str | None = Field(default=None,
validation_alias=AliasPath("category", "name"))` to `ProductOut` (`schemas/masters.py`) —
no migration needed, it's an ORM-level relationship over the existing `category_id`
column, `lazy="joined"` means no N+1 (one query, outer-joined, matching how the
`list_join=ProductCategory` search-filter already joins the same table). Verified via a
live request: `category_name` now comes back correctly (`"Services"`, `"Bedroom"`, etc.)
and all 94 backend tests still pass.

### Prevention (what now makes this structurally impossible, not just "we'll remember")
Not structurally prevented — this is a hand-written schema field per resource, same as
`vendor_name`/`customer_name`/`account_name` elsewhere, so a *new* derived-name field on a
*different* resource can still be forgotten the same way. Worth a quick grep sweep
(`grep -rn "_name:" backend/src/app/schemas/`) against every `frontend/src/lib/api.ts`
interface field ending in `_name` before shipping a new list screen, to catch the next one
before it ships rather than after a bug report.
