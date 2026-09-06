# 04 — API CONTRACT

> **This is the coordination surface between frontend and backend.**
> **Rule: this document changes BEFORE the code does, never after.** If you change an endpoint
> without editing this file first, you have broken the other half of the team without telling them.

---

## 1. UNIVERSAL CONVENTIONS (already implemented — apply to every endpoint you add)

**Base path:** `/api/v1`

### Error envelope — every non-2xx response
```json
{ "error": { "code": "OVERALLOCATED_PAYMENT",
             "message": "Payment exceeds the amount due on this invoice.",
             "fields": { "amount": "Must be at most 11,800.00" } } }
```
- `code` — `SCREAMING_SNAKE_CASE`, stable, what the frontend switches on
- `message` — safe to show a user
- `fields` — present only for validation errors; keys match the request body field names **exactly**
  so the frontend can drop them straight into form fields

**Invalid input must never produce a 500.** Always an enveloped 4xx.

### Standard codes
| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Body/query failed schema validation |
| `UNAUTHORIZED` | 401 | Missing/invalid/expired token |
| `FORBIDDEN` | 403 | Authenticated but role lacks permission |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Uniqueness or concurrent-state conflict |
| *(domain codes)* | 422 | ★ **Enumerate every one you add, in §4 below** |

> ⚠️ Last round this doc promised "domain codes below" and then never listed them. The frontend
> ended up guessing. **List every code you invent.**

### Paginated list envelope — every list endpoint
```json
{ "items": [ ... ], "total": 128, "page": 1, "page_size": 20, "pages": 7 }
```
Query params supported by `core/pagination.py` on any list endpoint:

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int ≥1 | 1 | |
| `page_size` | int 1..100 | 20 | |
| `sort` | string | — | `field` or `-field` for descending. **Allowlisted per endpoint** |
| `q` | string | — | Free-text search across that endpoint's declared searchable columns |

> ⚠️ **Frontend: KPI totals must read `total`, never `items.length`.** `items` is one page.
> This exact bug shipped last round and silently under-reported every count past 200 rows.

### Auth
- `POST /auth/login` sets an **httpOnly cookie**. The browser sends it automatically —
  the frontend never handles a token.
- `Authorization: Bearer <token>` also works, for `curl` and Swagger demos.
- Every endpoint except `/health` and `/auth/login` requires authentication.

---

## 2. ENDPOINTS ALREADY BUILT

| Method | Path | Auth | Returns |
|---|---|---|---|
| `GET` | `/health` | none | `{status, database, version}` |
| `POST` | `/auth/login` | none | `{user}` + sets cookie |
| `POST` | `/auth/token` | none | `{access_token, token_type}` — curl/Swagger only |
| `POST` | `/auth/logout` | user | `{ok: true}` + clears cookie |
| `GET` | `/auth/me` | user | `{id, email, full_name, role}` |
| `GET` | `/events` | user | **SSE stream**, 15s heartbeat |
| `GET` | `/notifications` | user | Paginated, scoped to the calling user only |
| `POST` | `/notifications/read-all` | user | `{marked_read: n}` |
| `GET` | `/audit-logs` | admin role | Paginated audit trail. Each row carries the acting `user` (id, name, email) rather than a bare `user_id` — a screen showing UUIDs answers "who" with something nobody can read. Filters: `entity_name`, `outcome` (`accepted` · `rejected`), `user_id`. Records **rejected** writes too, so a refused permission is visible; only 2xx were kept before, which made the outcome column unable to ever say anything but "accepted". |

### SSE event frames
```
event: connected
data: {"ts": "2026-09-05T10:00:00Z"}

event: <domain>.<action>
data: {"id": "...", ...}

: heartbeat        ← comment frame every 15s, keeps proxies from closing the stream
```
Naming convention: `noun.verb_past` — e.g. `document.posted`, `payment.registered`,
`ledger.changed`.

---

## 3. DOMAIN ENDPOINTS — Urban Furniture Accounting

**Roles:** `Admin` · `Accountant` · `User`.
Reads are open to any authenticated internal user; writes are gated. The **User** role
reaches only `/portal/*`, and every portal query is additionally scoped to
`contact_id = current_user.contact_id` — a data-scoping rule, not an RBAC role.

### 3.0 Sign up

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/signup` | none | Self-registration — always creates an **Accountant** |

```json
{ "login_id": "rmehta21", "email": "r@example.com",
  "full_name": "R. Mehta", "password": "..." }
```

Validation, enforced server-side and mirrored in `validation.ts`:
`login_id` unique and 6–12 characters · `email` not already present · `password` longer than
8 characters and containing a lowercase letter, an uppercase letter and a special character.
Failures return `VALIDATION_ERROR` with per-field messages.

> The mockup is explicit that signup creates an invoicing user. Admin and portal accounts are
> created by an Admin, never by self-registration.

### 3.1 Master data — 6 modules, one shape

All six behave identically, so they are specified once:

| Method | Path | Role | Purpose |
|---|---|---|---|
| `GET` | `/{module}` | any internal | List — paginated |
| `GET` | `/{module}/{id}` | any internal | Detail |
| `POST` | `/{module}` | Admin, **Accountant** | Create |
| `PATCH` | `/{module}/{id}` | **Admin only** | Modify |
| `POST` | `/{module}/{id}/archive` | **Admin only** | Archive (never a hard delete) |

`{module}` ∈ `contacts` · `products` · `product-categories` · `accounts` · `journals` ·
`analytic-accounts`

`POST /product-categories` also accepts a bare `{"name": "..."}` from the product form's
combobox, so a category can be created inline without leaving the screen.

> ⚠️ **The Admin/Accountant split is a real, tested rule**, taken from the statement's own
> wording: the Accountant "Creates Master Data"; only the Admin "Creates/Modify/Archived".
> An Accountant `PATCH` must return **403 `FORBIDDEN`**, not succeed quietly.

| Module | `sort` allowlist | `q` searches |
|---|---|---|
| `contacts` | `name`, `type`, `created_at` | `name`, `email`, `mobile` |
| `products` | `name`, `sales_price`, `cost_price` | `name`, category name |
| `product-categories` | `name` | `name` |
| `accounts` | `code`, `name`, `type` | `code`, `name` |
| `journals` | `name`, `type` | `name` |
| `analytic-accounts` | `name`, `type` | `name` |

### 3.2 Purchase chain

| Method | Path | Role | Purpose |
|---|---|---|---|
| `GET`/`POST` | `/purchase-orders` | any / Admin+Accountant | List, create |
| `GET` | `/purchase-orders/{id}` | any | Detail with lines |
| `POST` | `/purchase-orders/{id}/confirm` | Admin+Accountant | `DRAFT → CONFIRMED` |
| `POST` | `/purchase-orders/{id}/create-bill` | Admin+Accountant | `CONFIRMED → BILLED`, returns the new bill |
| `POST` | `/purchase-orders/{id}/cancel` | Admin+Accountant | → `CANCELLED` |
| `GET`/`POST` | `/vendor-bills` | any / Admin+Accountant | |
| `POST` | `/vendor-bills/{id}/post` | Admin+Accountant | **Generates the journal entry** |
| `POST` | `/vendor-bills/{id}/cancel` | Admin only | Reverses the entry if posted |

### 3.3 Sales chain

Identical shape: `/sales-orders` with `/confirm`, `/create-invoice`, `/cancel`, and
`/customer-invoices` with `/post`, `/cancel`.

### 3.4 Payments

| Method | Path | Role | Purpose |
|---|---|---|---|
| `GET` | `/payments` | any | Paginated |
| `POST` | `/payments` | Admin+Accountant | Register and post in one transaction |

**Create request** — `Idempotency-Key` header **required**:
```json
{ "invoice_id": "uuid",
  "direction": "RECEIVE",
  "journal_id": "uuid",
  "amount": 11800.00,
  "payment_date": "2026-09-05",
  "note": "UPI ref 4471" }
```
Exactly one of `invoice_id` or `bill_id`. `amount` may not exceed the document's remaining
balance (`total − amount_paid`) or the call returns `OVERALLOCATED_PAYMENT`. Partial payment
is simply an amount less than the balance — the document moves to `PARTIAL`.

Partner and amount are **pre-filled by the client from the source document**, matching the
mockup's Pay flow, but the server re-derives both and ignores anything inconsistent.

### 3.5 Document output — print, PDF and email

Available on `customer-invoices` and `vendor-bills`.

| Method | Path | Role | Returns |
|---|---|---|---|
| `GET` | `/{doc}/{id}/pdf` | any internal · owner via portal | `application/pdf`, rendered from the same HTML the print view uses |
| `POST` | `/{doc}/{id}/send` | Admin+Accountant | `{queued: true, to: "..."}` |

`GET /reports/{name}/pdf` does the same for Balance Sheet and Profit & Loss — the mockup
annotates the P&L screen *"Pdf download on click"*.

> **`send` never blocks anything.** It returns as soon as the message is queued, and a
> delivery failure is recorded on the document rather than raised — the document is already
> posted, and mail must not be able to roll that back. The UI reads `last_sent_at` and
> `last_send_error` to report *sent* or *not sent* honestly. See
> [`01_STACK.md`](01_STACK.md) §3.2 for why this is contained so carefully.

### 3.6 Budgets

| Method | Path | Role | Purpose |
|---|---|---|---|
| `GET`/`POST` | `/budgets` | any / Admin+Accountant | List, create |
| `GET` | `/budgets/{id}` | any | Detail — lines include the **computed** achieved figures |
| `POST` | `/budgets/{id}/confirm` | Admin+Accountant | `DRAFT → CONFIRMED` |
| `POST` | `/budgets/{id}/revise` | Admin+Accountant | Creates the successor, returns it |
| `POST` | `/budgets/{id}/cancel` | Admin+Accountant | → `CANCELLED` |
| `GET` | `/budgets/{id}/lines/{line_id}/documents` | any | The invoices or bills behind an achieved figure |

```json
// GET /budgets/{id} — one line
{ "analytic_account": "Furniture", "type": "EXPENSE",
  "committed_amount": 200000.00,
  "achieved_amount":   10000.00,   // computed
  "achieved_pct":          5.00,   // computed
  "amount_to_achieve": 190000.00 } // computed
```

`POST /revise` is not an edit. It creates a new budget carrying the original's lines and the
original's name plus `" Revised"`, moves the original to `REVISED`, and links both directions.
Reviving a non-`CONFIRMED` budget returns `INVALID_STATUS_TRANSITION`.

### 3.7 The ledger — read-only, and that is the point

| Method | Path | Role | Purpose |
|---|---|---|---|
| `GET` | `/journal-entries` | any | Paginated. Filters: `journal_id`, `account_id`, `date_from`, `date_to`, `state` |
| `GET` | `/journal-entries/{id}` | any | Entry with all its lines |

There is **no** `POST`, `PATCH` or `DELETE` on the ledger. Entries are created only as a
side effect of posting a document. Corrections happen through `/cancel`, which writes a
*reversing* entry.

### 3.8 Reports

| Method | Path | Query | Returns |
|---|---|---|---|
| `GET` | `/reports/balance-sheet` | `as_of` | Assets, Liabilities, Equity — grouped, with per-account rows |
| `GET` | `/reports/profit-and-loss` | `date_from`, `date_to` | Income, Expense, net profit |
| `GET` | `/reports/budget` | `budget_id` | Planned vs actual vs variance per analytic account |
| `GET` | `/reports/trial-balance` | `as_of` | Per-account debit/credit totals **and `is_balanced`** |
| `GET` | `/reports/{name}/export` | as above | `text/csv` stream |

```json
// GET /reports/trial-balance
{ "as_of": "2026-09-05",
  "rows": [ { "account_code": "1100", "account_name": "Debtors",
              "debit": 250000.00, "credit": 100000.00 } ],
  "total_debit": 812500.00,
  "total_credit": 812500.00,
  "difference": 0.00,
  "is_balanced": true }
```

`is_balanced` drives the **`Trial balance 0.00 ✓`** badge in the UI. It is computed, never
asserted.

```json
// GET /reports/balance-sheet — assets, liabilities and equity are each ONE flat
// group (not one section per account type). Equity carries retained earnings as
// a synthetic row (account_code "") so its own total is what balances against
// assets — nothing is added in on the client.
{ "as_of": "2026-09-05",
  "assets":      { "key": "assets",      "label": "Assets",      "rows": [ /* AccountBalanceRow */ ], "total": 500000.00 },
  "liabilities": { "key": "liabilities", "label": "Liabilities", "rows": [ /* ... */ ],               "total": 120000.00 },
  "equity":      { "key": "equity",      "label": "Equity",      "rows": [
                     { "account_id": "…", "account_code": "3000", "account_name": "Capital", "balance": 350000.00 },
                     { "account_id": "retained-earnings", "account_code": "", "account_name": "Retained Earnings", "balance": 30000.00 }
                   ], "total": 380000.00 },
  "total_assets": 500000.00,
  "total_liabilities": 120000.00,
  "retained_earnings": 30000.00,
  "total_liabilities_and_capital": 500000.00,
  "is_balanced": true }
```

```json
// GET /reports/profit-and-loss — income/expenses/other_expenses are each ONE
// flat group (note the plural field names — not `expense`/`other_expense`).
{ "date_from": "2026-08-01", "date_to": "2026-09-05",
  "income": { "key": "INCOME", "label": "Income", "rows": [ /* ... */ ], "total": 200000.00 },
  "expenses": { "key": "EXPENSE", "label": "Expenses", "rows": [ /* ... */ ], "total": 150000.00 },
  "other_expenses": { "key": "OTHER_EXPENSE", "label": "Other Expenses", "rows": [], "total": 0.00 },
  "total_income": 200000.00, "total_expenses": 150000.00, "net_profit": 50000.00 }
```

```json
// GET /reports/budget — field is `lines`, not `rows`; figures are named
// committed/achieved, not planned/actual/variance. amount_to_achieve < 0 means
// achieved has already exceeded committed (over budget).
{ "budget_id": "…", "budget_name": "FY26 Furniture",
  "period_start": "2026-04-01", "period_end": "2027-03-31", "state": "CONFIRMED",
  "lines": [ { "analytic_account_id": "…", "analytic_account": "Furniture", "type": "EXPENSE",
               "committed_amount": 200000.00, "achieved_amount": 10000.00,
               "achieved_pct": 5.00, "amount_to_achieve": 190000.00 } ],
  "total_committed": 200000.00, "total_achieved": 10000.00, "total_to_achieve": 190000.00 }
```

### 3.9 Portal — User role only

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/portal/documents` | The caller's own invoices **and** bills, paginated |
| `GET` | `/portal/documents/{id}` | Detail — 404 (never 403) if it isn't theirs |
| `POST` | `/portal/payments` | Pay one of their own documents |

> Returning **404 rather than 403** for another contact's document is deliberate: a 403
> confirms the record exists, which leaks information across tenants.

### 3.10 SSE events

| Event | Payload | Fires when |
|---|---|---|
| `document.posted` | `{type, id, number, total}` | A bill or invoice posts |
| `payment.registered` | `{id, contact, amount}` | A payment posts |
| `ledger.changed` | `{total_debit, total_credit, is_balanced}` | **After every posting** — drives the live badge |
| `kpi.refresh` | `{receivables, payables, cash, net_profit}` | After any ledger change |

---

## 4. DOMAIN ERROR CODE REGISTRY — every code, no exceptions

| Code | HTTP | Meaning | Raised in |
|---|---|---|---|
| `UNBALANCED_ENTRY` | 422 | `Σ debit ≠ Σ credit`. Should be unreachable — it is the last guard before commit | `services/posting.py` |
| `ALREADY_POSTED` | 409 | Document already has a live journal entry | `services/posting.py` |
| `CANNOT_MODIFY_POSTED` | 409 | Edit or delete attempted on a `POSTED` document or entry | `services/posting.py` |
| `INVALID_STATUS_TRANSITION` | 422 | e.g. billing a `DRAFT` PO, posting a `CANCELLED` invoice | `services/rules.py` |
| `ACCOUNT_ARCHIVED` | 422 | A posting targets an archived account | `services/posting.py` |
| `MISSING_ACCOUNT_MAPPING` | 422 | Contact or product has no account to post to | `services/posting.py` |
| `PERIOD_CLOSED` | 422 | Entry date falls in a locked period *(bonus scope)* | `services/posting.py` |
| `OVERALLOCATED_PAYMENT` | 422 | An allocation exceeds the document's remaining balance | `services/payments.py` |
| `DUPLICATE_PAYMENT` | 409 | `Idempotency-Key` already used — returns the original payment | `routers/payments.py` |
| `INVALID_JOURNAL_TYPE` | 422 | Payment journal is not `BANK` or `CASH` | `services/payments.py` |
| `CONTACT_TYPE_MISMATCH` | 422 | A vendor on a sales document, or a customer on a purchase | `services/rules.py` |
| `BUDGET_PERIOD_INVALID` | 422 | `period_end <= period_start` | `schemas/budgets.py` |
| `BUDGET_NOT_CONFIRMED` | 422 | Revise attempted on a budget that isn't `CONFIRMED` | `services/budgets.py` |
| `ALREADY_REVISED` | 409 | The budget already has a successor | `services/budgets.py` |
| `LOGIN_ID_TAKEN` | 409 | Sign-up login ID already exists | `routers/auth.py` |
| `EMAIL_TAKEN` | 409 | Sign-up email already exists | `routers/auth.py` |
| `WEAK_PASSWORD` | 422 | Fails the length or character-class rules | `schemas/auth.py` |
| `MAIL_NOT_CONFIGURED` | 422 | `Send` called with no SMTP host configured | `services/mail.py` |
| `EMPTY_DOCUMENT` | 422 | Confirm/post attempted with zero lines, **or** a document whose lines total 0.00 | `services/documents.py` |
| `CANNOT_CANCEL_WITH_PAYMENTS` | 409 | Cancel attempted on a document with `amount_paid > 0` | `services/documents.py` |
| `CONTACT_ARCHIVED` | 422 | An archived contact used on a new document | `services/documents.py` |
| `PRODUCT_ARCHIVED` | 422 | An archived product added to a new document line | `services/documents.py` |
| `PDF_ENGINE_UNAVAILABLE` | 503 | No PDF renderer installed on the server — the print view still works | `services/rendering.py` |
| `ROLE_NOT_CONFIGURED` | 422 | Sign-up attempted before roles were seeded | `routers/auth.py` |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password — deliberately identical for both | `routers/auth.py` |
| `ACCOUNT_INACTIVE` | 403 | The account exists but has been deactivated | `routers/auth.py` |
| `CONFLICT` | 409 | A unique constraint rejected a create or patch (account code, contact email, …) | `routers/masters.py` |

`fields` keys match request body field names exactly, so the UI drops each message
straight into the matching input.

**Add a row the moment you invent a code.** Last round this table was left empty and the
frontend guessed.

---

## 4.1 ADDED DURING IMPLEMENTATION

> ⚠️ **Logged after the fact, against §5's own rule.** These were added while
> building the backend rather than announced first. They are all additive — no
> endpoint in §3 changed shape or disappeared — but the protocol exists so the
> frontend is never surprised, and this section is the correction.

| Method | Path | Role | Why it exists |
|---|---|---|---|
| `GET` | `/reports/kpis` | internal | §3.10 promises a `kpi.refresh` event but no endpoint to read the same four figures on first paint. The tiles need a value before the first event arrives. |
| `GET` | `/{doc}/{id}/print` | internal · owner | The HTML the PDF is rendered from. §3.5 specifies the PDF; the print view is the same artefact and is what makes "Print" work without a download. |
| `GET` | `/portal/invoices` · `/portal/bills` | portal | §3.9 specifies a combined `/portal/documents`. Both split views exist too, because a contact who is `BOTH` needs to filter one from the other. |
| `PATCH` | `/sales-orders/{id}` · `/purchase-orders/{id}` · `/customer-invoices/{id}` · `/vendor-bills/{id}` | Admin+Accountant | §3 lists create and the transitions but no edit. A draft has to be editable before it is confirmed. **Draft only** — a posted document returns `CANNOT_MODIFY_POSTED`. |
| `GET` | `/payments/{id}` | internal | Detail for a row in the payments list. |
| `GET` | `/budgets/{id}/lines/{line_id}/documents` | internal | Specified in §3.6; listed here because the response shape was not. Returns `[{document_type, id, number, date, contact_id, status, amount}]`. |
| `GET` | `/analytics/trend` | internal | Monthly income, expense and net profit aggregated from `journal_lines`. `months` (1–36, default 12). Months are contiguous — a month with no postings returns zeros rather than being skipped, so a chart shows a flat stretch instead of closing the gap and implying continuity. |
| `GET` | `/analytics/breakdown` | internal | Income and expense split by analytic account, from the same lines. Slices carry `type` so a caller can separate revenue from cost — one chart mixing both has no meaningful total. |
| `GET` | `/analytics/top-contacts` | internal | Highest-value contacts by posted amount. `limit` (1–25, default 5). |
| `GET` | `/analytics/ageing` | internal | Receivable and payable ageing buckets (0–30 · 31–60 · 61–90 · 90+). The one report that reads documents rather than the ledger, deliberately: an ageing bucket is a property of the *document's* due date, which no journal line carries. |
| `GET` | `/status-counts` | internal | All / Draft / Confirmed and every other state, per document module, in one request. Backs the mockup's per-module counts (`PROBLEM_STATEMENT.md` §4 item 14). One call rather than one per module, because every consumer wants the whole set at once. |

**`GET /status-counts` response.** Keyed by module so a caller indexes rather than
searches; `by_status` holds the raw state names the document already uses, so a new
state appears here without a contract change:

```json
{
  "modules": {
    "sales_orders":      { "total": 40, "by_status": { "DRAFT": 2, "CONFIRMED": 10, "INVOICED": 28 } },
    "customer_invoices": { "total": 38, "by_status": { "DRAFT": 1, "POSTED": 20, "PAID": 17 } }
  }
}
```

> ⚠️ **`/analytics/*` was built before it was written down here** — the same
> §5 breach this section exists to correct, repeated. Logged now rather than
> quietly left out.

**Query parameters added:**

| Endpoint | Param | Notes |
|---|---|---|
| all master-data lists | `include_archived` | Default `false`. Archived rows are hidden from lists but remain fetchable by id, because documents still reference them. |
| document lists | `status`, `vendor_id` / `customer_id` | Backs the dashboard's All / Confirmed / Draft counts. |
| `/journal-entries` | `source_type` | `customer_invoice` · `vendor_bill` · `payment` · `manual`. |
| `/payments` | `contact_id`, `direction` | |

**Two behaviours worth stating explicitly, because the codes alone are ambiguous:**

1. **A replayed `Idempotency-Key` returns `200` with the original payment**, not
   `409`. A retry is not an error, and answering 409 pushes the client into an
   error path for something that succeeded. `DUPLICATE_PAYMENT` (409) is reserved
   for the genuinely conflicting case: the **same key reused for a different
   payment** (different document or different amount).
2. **`POST /budgets/{id}/revise` returns `201`**, not 200 — it creates a new
   budget and returns the successor.

**Account defaults on create.** `POST /contacts` fills `receivable_account_id` /
`payable_account_id` from the seeded Debtors and Creditors accounts when they are
not supplied, exactly as [`03_DATA_MODEL.md`](03_DATA_MODEL.md) §2 specifies.
`POST /products` does the same for `income_account_id` / `expense_account_id`
from Sales Income and Purchase Expense — **not** specified there, but the failure
it prevents is worse: a product with no income account can be created, added to
an invoice, and only refused at the moment someone clicks Post. Both remain
overridable per record and per document line.

---

## 5. CONTRACT CHANGE PROTOCOL

1. Edit this file **first**
2. Say it out loud to the room (or in the group chat) — one line: *"changing X to Y"*
3. Then change the backend
4. Frontend updates `lib/api.ts` types to match

The QA owner (Card D) polices drift. A contract change that isn't announced is how you get a
frontend calling an endpoint that no longer exists at 23:00.
