# 🟡 Pending — index & board

> This file **is** the board for anything still at checklist level. Spin a phase out into
> its own file in this folder **only** once it needs more than checkboxes — a blocker, a
> mid-build design decision, a sub-thread worth preserving. The moment you do: update the
> table below to point at the new file, and move that phase's detail out of this file.

| Phase | Status |
|---|---|
| 0 — Scaffold the boilerplate | 🟢 done — see `../done/2026-09-05-platform-and-schema-verified.md` |
| 1 — Ledger foundation | 🟡 schema migrated, **engine not started** |
| 2 — Master data | 🟡 models migrated, mappings/routers not started |
| 3 — Sales chain (finish before starting purchase) | 🟡 not started |
| 4 — Purchase chain | 🟡 not started |
| 5 — Reports | 🟡 not started |
| 6 — Budgets | 🟡 model + migration exist, computation/revision not started |
| 7 — PDF, email, portal, sign-up | 🟡 not started |
| 8 — Real-time proof | 🟡 not started |

Build order is not negotiable — ledger before documents, sales chain finished end to end
before purchase starts. See `../../docs/06_BACKEND.md` §1. Move a line to `../done/` the
moment it's built **and verified** — a test passes, or you clicked it in the browser — not
because it compiles.

🔴 **STALE — flagged 2026-09-05, later same day.** `git log` and `backend/README.md` show a
full backend merge since the table below was last written (`services/posting.py`, every
router, `feat: implement core accounting, sales, and purchase modules...`). The phase table
below likely understates what's built. Don't trust it — re-run `git log --oneline` and
`ls backend/src/app/{services,routers}` before picking up backend work. See
`../done/2026-09-05-design-full-apple-aesthetic.md`'s closing note.

⚠️ **Re-verified 2026-09-05 (superseded by the flag above).** `backend/` + `frontend/` exist
and pass (32 backend tests, frontend build green) — full detail in
`../done/2026-09-05-platform-and-schema-verified.md`.
**The entire domain schema is already migrated** (all 24 tables, CHECK/UNIQUE constraints,
the partial-unique double-posting guard) — but every phase below is still schema-only until
its ✅ box says otherwise. Don't assume a router, service or screen exists just because its
table does.

---

## Phase 1 — ledger foundation
- [x] Chart of Accounts + Journals models, migration, seed (8 account types) — verified:
      `models/masters.py` (`Account`, `Journal`), migration creates `accounts`/`journals`,
      `seed/seed.py` has `seed_chart_of_accounts()` + `seed_journals()`
- [x] `journal_entries` + `journal_lines` with all three CHECK constraints — verified in
      `models/ledger.py` and the migration (`ck_journal_lines_nonneg`, `_one_sided`,
      `_not_empty`), plus the partial-unique `uq_journal_entries_source_live` double-posting
      guard
- [ ] `services/posting.py` — `post_entry()` + `reverse_entry()` — **does not exist yet.**
      This is the single most important remaining file (`RULES.md` §3)
- [ ] Ledger invariant tests (`docs/07_TESTING_AND_REVIEW.md` §1.1) — write these *with* the
      engine, not after it

## Phase 2 — master data
- [x] Contacts, Products, Product Categories, Analytic Accounts — models + migration exist
      (`models/masters.py`)
- [ ] Account mappings actually wired into a create/edit flow (receivable/payable on
      contact, income/expense on product) — no router or schema yet, so this can't be
      exercised through the API
- [ ] Master-data routers (`/contacts`, `/products`, `/product-categories`, `/accounts`,
      `/journals`, `/analytic-accounts`) — `routers/domain.py` is still the placeholder

## Phase 3 — sales chain, end to end (finish this before starting purchase)
- [x] `SalesOrder`, `SalesOrderLine`, `CustomerInvoice`, `CustomerInvoiceLine` models +
      migration exist (`models/documents.py`)
- [ ] Sales Order → confirm → Customer Invoice → post → Payment — no router, no schema, no
      service; depends on Phase 1's `posting.py` first
- [ ] Posting preview (T-account) on the invoice screen

## Phase 4 — purchase chain (mirrors phase 3)
- [x] `PurchaseOrder`, `PurchaseOrderLine`, `VendorBill`, `VendorBillLine` models + migration
      exist
- [ ] Purchase Order → confirm → Vendor Bill → post → Payment (direction SEND)

## Phase 5 — reports
- [ ] Balance Sheet, P&L, Trial Balance (with `is_balanced`), Budget report — pure
      aggregation over `journal_lines`, never `SUM(documents.total)`. Depends on Phase 1.
- [ ] Drill-down: report figure → account → journal lines → source document

## Phase 6 — budgets
- [x] `Budget`, `BudgetLine` models + migration exist (`models/budgets.py`), including the
      `revision_of_id`/`revised_with_id` link columns and `ck_budgets_period_valid`
- [ ] Computed achieved / achieved_pct / to_achieve — no `services/budgets.py` yet
- [ ] Revision chain endpoint (`revise` creates a successor, never edits the original)

## Phase 7 — PDF, email, portal, sign-up
- [x] `Payment` model + migration exist (`models/payments.py`), including
      `ck_payments_exactly_one_target` and the unique `idempotency_key`
- [ ] WeasyPrint PDF for invoices/bills + the P&L
- [ ] Best-effort email send — never blocks a posting
- [ ] Portal endpoints (contact-scoped, 404 not 403 for another contact's document)
- [ ] Sign-up page (self-registration → always creates an Accountant) — note:
      `frontend/src/app/login/page.tsx` still shows placeholder demo accounts
      (Administrator/Manager/Operator/Viewer), not the real roles

## Phase 8 — real-time proof
- [ ] Simulator ticks a real payment through the real service functions, not a direct write
      — `services/simulator.py` exists as a skeleton only; needs Phase 1's engine first
- [ ] Trial-balance badge in the app shell, live over SSE

---

## Mandatory deliverables checklist (`../../docs/PROBLEM_STATEMENT.md` §2 — the grade floor)
- [ ] Contact, Product, Chart of Accounts, Journal, Journal Entry master data — schema ✅,
      not reachable through the API/UI yet
- [ ] Purchase Order → Vendor Bill → Payment
- [ ] Sales Order → Customer Invoice → Payment (with tax)
- [ ] Analytic Account + Budget
- [ ] Balance Sheet
- [ ] Profit & Loss
- [ ] Budget Report
- [ ] Contact portal — view own documents, make payment
- [ ] Three roles enforced server-side
