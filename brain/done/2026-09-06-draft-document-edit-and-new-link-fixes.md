### What
Audited every list screen for edit/delete affordances and added what the business
flow actually supports:
- **Edit while DRAFT**: Purchase Orders, Vendor Bills, Sales Orders, Customer
  Invoices, and Budgets can now be edited (header fields + line items) from their
  view drawer while still DRAFT, via the backend's existing `PATCH` endpoints
  (`update_purchase_order` etc. in `services/documents.py` / `services/budgets.py`)
  which were already lock-then-recheck-DRAFT-status guarded but had no frontend
  caller. Added `.update()` to each resource in `lib/api.ts`.
- **Delete-equivalent**: already covered everywhere it makes sense — Cancel on
  DRAFT/POSTED orders/bills/invoices/budgets, Archive on master data. Journal
  entries correctly have neither (immutable, reversal-only per RULES.md §7) —
  left untouched.
- **Fixed 4 dead links**: the "New …" buttons on Purchase Orders, Sales Orders,
  Sale Invoices, and Receipts still pointed at `/…/new` routes that a prior
  refactor (`fc4a9ae`) had already deleted in favor of drawers. Swapped for
  `panel.hrefFor("new")`, matching every other list page.
- **Real bug caught while verifying**: Budget's "Responsible" `<select>` only
  lists active contacts, so opening a budget whose responsible contact is now
  archived showed a blank picker — saving without touching it would have
  silently nulled `responsible_id`. Fixed by injecting the current value back in
  as an option when it's missing from the fetched list.

### Why
User asked, in their own words: "we have so many data so some data need edit and
delete options so check all pages and if as per our flow we can add edit and
delete option so add." Master data (accounts/contacts/products/journals/
analyticals) already had full edit+archive from earlier work; the document
chains (PO/bill/SO/invoice/budget) only had create+cancel — no way to fix a typo
on a DRAFT before confirming/posting it.

### Verified
`tsc --noEmit`, `next build`, and `eslint` all clean. Live-tested via Playwright
against the already-running dev servers (accountant + admin demo logins): opened
a DRAFT PO, edited a line, saved, confirmed persistence + list refresh; same for
a freshly-created DRAFT vendor bill and customer invoice; confirmed the archived-
responsible budget fix specifically (`Showroom Refit (draft)`, responsible
`Azure Furniture Pvt Ltd`) survives a no-op save. All "New …" buttons open their
drawer instead of 404ing. Test records created during verification were
cancelled again afterward (Bill/2026/0025, INV/2026/0034); P00032's transient
edits were reverted via the same PATCH endpoint.

### Touches
`frontend/src/lib/api.ts` (added `update` + `*Update` types for salesOrders,
customerInvoices, purchaseOrders, vendorBills, budgets); `frontend/src/app/{
purchase/orders,purchase/bills,sales/orders,sales/invoices,account/budgets,
sales/receipts}/page.tsx`.
