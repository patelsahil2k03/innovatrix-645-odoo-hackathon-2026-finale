# 🟡 Pending — index & board

> This file **is** the board for anything still at checklist level. Spin a phase out into
> its own file in this folder **only** once it needs more than checkboxes — a blocker, a
> mid-build design decision, a sub-thread worth preserving. The moment you do: update the
> table below to point at the new file, and move that phase's detail out of this file.

| Phase | Status |
|---|---|
| 0 — Scaffold the boilerplate itself | 🟡 not started — see `../mistakes/2026-09-05-docs-vs-repo-state-gap.md` |
| 1 — Ledger foundation | 🟡 not started |
| 2 — Master data | 🟡 not started |
| 3 — Sales chain (finish before starting purchase) | 🟡 not started |
| 4 — Purchase chain | 🟡 not started |
| 5 — Reports | 🟡 not started |
| 6 — Budgets | 🟡 not started |
| 7 — PDF, email, portal, sign-up | 🟡 not started |
| 8 — Real-time proof | 🟡 not started |

Build order is not negotiable — ledger before documents, sales chain finished end to end
before purchase starts. See `../../docs/06_BACKEND.md` §1. Move a line to `../done/` the
moment it's built **and verified** — a test passes, or you clicked it in the browser — not
because it compiles.

---

## Phase 0 — scaffold the boilerplate itself
⚠️ **Verified 2026-09-05: this is NOT done.** No `backend/` or `frontend/` directory exists
on any branch in this repo yet (see the mistakes entry linked above). Until this phase is
verified complete, treat every "already built" claim elsewhere in `docs/` as a **target
spec**, not current fact.

- [ ] `backend/` — FastAPI app factory, settings, DB session, error envelope, bcrypt auth,
      JWT + RBAC, pagination helper, SSE hub, audit middleware, seed framework
- [ ] `frontend/` — Next.js app shell, design tokens, auth context, API client, UI
      primitives, per the existing hooks-based pattern. State-management library is
      **on hold** — see `../RULES.md` §8. Components stay presentational either way: no
      business logic inline in `.tsx`.
- [ ] `scripts/dev.sh`, `demo-reset.sh`, `verify-sse.sh`
- [ ] `infra/` Postgres compose file
- [ ] Confirm both run end to end from a fresh clone, per the root README's quick start
- [ ] Once genuinely verified (tests green, build green, run locally) — move this whole
      phase to `../done/` with the exact commands used to verify it

## Phase 1 — ledger foundation
- [ ] Chart of Accounts + Journals models, migration, seed (8 account types)
- [ ] `journal_entries` + `journal_lines` with all three CHECK constraints
- [ ] `services/posting.py` — `post_entry()` + `reverse_entry()`
- [ ] Ledger invariant tests (`docs/07_TESTING_AND_REVIEW.md` §1.1) — write these *with* the
      engine, not after it

## Phase 2 — master data
- [ ] Contacts, Products, Product Categories (inline-create combobox), Analytic Accounts
- [ ] Account mappings (receivable/payable on contact, income/expense on product)

## Phase 3 — sales chain, end to end (finish this before starting purchase)
- [ ] Sales Order → confirm → Customer Invoice → post → Payment
- [ ] Posting preview (T-account) on the invoice screen

## Phase 4 — purchase chain (mirrors phase 3)
- [ ] Purchase Order → confirm → Vendor Bill → post → Payment (direction SEND)

## Phase 5 — reports
- [ ] Balance Sheet, P&L, Trial Balance (with `is_balanced`), Budget report — pure
      aggregation over `journal_lines`, never `SUM(documents.total)`
- [ ] Drill-down: report figure → account → journal lines → source document

## Phase 6 — budgets
- [ ] Budget + budget lines, computed achieved / achieved_pct / to_achieve
- [ ] Revision chain (`revise` creates a successor, never edits the original)

## Phase 7 — PDF, email, portal, sign-up
- [ ] WeasyPrint PDF for invoices/bills + the P&L
- [ ] Best-effort email send — never blocks a posting
- [ ] Portal endpoints (contact-scoped, 404 not 403 for another contact's document)
- [ ] Sign-up page (self-registration → always creates an Accountant)

## Phase 8 — real-time proof
- [ ] Simulator ticks a real payment through the real service functions, not a direct write
- [ ] Trial-balance badge in the app shell, live over SSE

---

## Mandatory deliverables checklist (`../../docs/PROBLEM_STATEMENT.md` §2 — the grade floor)
- [ ] Contact, Product, Chart of Accounts, Journal, Journal Entry master data
- [ ] Purchase Order → Vendor Bill → Payment
- [ ] Sales Order → Customer Invoice → Payment (with tax)
- [ ] Analytic Account + Budget
- [ ] Balance Sheet
- [ ] Profit & Loss
- [ ] Budget Report
- [ ] Contact portal — view own documents, make payment
- [ ] Three roles enforced server-side
