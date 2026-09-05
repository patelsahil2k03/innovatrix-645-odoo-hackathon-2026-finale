# 04 — API CONTRACT

> **This is the coordination surface between frontend and backend.**
> **Rule: this document changes BEFORE the code does, never after.** If you change an endpoint
> without editing this file first, you have broken the other half of the team without telling them.

---

## 1. UNIVERSAL CONVENTIONS (already implemented — apply to every endpoint you add)

**Base path:** `/api/v1`

### Error envelope — every non-2xx response
```json
{ "error": { "code": "CARGO_EXCEEDS_CAPACITY",
             "message": "Human-readable explanation.",
             "fields": { "cargo_weight_kg": "Must be at most 500" } } }
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
| `GET` | `/audit-logs` | admin role | Paginated audit trail |

### SSE event frames
```
event: connected
data: {"ts": "2026-09-05T10:00:00Z"}

event: <domain>.<action>
data: {"id": "...", ...}

: heartbeat        ← comment frame every 15s, keeps proxies from closing the stream
```
Naming convention: `noun.verb_past` — e.g. `order.created`, `order.dispatched`, `kpi.refresh`.

---

## 3. DOMAIN ENDPOINTS — Urban Furniture Accounting

**Roles:** `Admin` · `Accountant` · `Contact`.
Reads are open to any authenticated internal user; writes are gated. The **Contact** role
reaches only `/portal/*`, and every portal query is additionally scoped to
`contact_id = current_user.contact_id` — a data-scoping rule, not an RBAC role.

### 3.1 Master data — 5 modules, one shape

All five behave identically, so they are specified once:

| Method | Path | Role | Purpose |
|---|---|---|---|
| `GET` | `/{module}` | any internal | List — paginated |
| `GET` | `/{module}/{id}` | any internal | Detail |
| `POST` | `/{module}` | Admin, **Accountant** | Create |
| `PATCH` | `/{module}/{id}` | **Admin only** | Modify |
| `POST` | `/{module}/{id}/archive` | **Admin only** | Archive (never a hard delete) |

`{module}` ∈ `contacts` · `products` · `accounts` · `journals` · `analytic-accounts`

> ⚠️ **The Admin/Accountant split is a real, tested rule**, taken from the statement's own
> wording: the Accountant "Creates Master Data"; only the Admin "Creates/Modify/Archived".
> An Accountant `PATCH` must return **403 `FORBIDDEN`**, not succeed quietly.

| Module | `sort` allowlist | `q` searches |
|---|---|---|
| `contacts` | `name`, `type`, `created_at` | `name`, `email`, `mobile` |
| `products` | `name`, `category`, `sales_price` | `name`, `category` |
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
{ "contact_id": "uuid",
  "direction": "INBOUND",
  "journal_id": "uuid",
  "amount": 15000.00,
  "payment_date": "2026-09-05",
  "allocations": [ { "invoice_id": "uuid", "amount": 15000.00 } ] }
```
`Σ allocations` must equal `amount`, and no allocation may exceed its document's
remaining balance.

### 3.5 The ledger — read-only, and that is the point

| Method | Path | Role | Purpose |
|---|---|---|---|
| `GET` | `/journal-entries` | any | Paginated. Filters: `journal_id`, `account_id`, `date_from`, `date_to`, `state` |
| `GET` | `/journal-entries/{id}` | any | Entry with all its lines |

There is **no** `POST`, `PATCH` or `DELETE` on the ledger. Entries are created only as a
side effect of posting a document. Corrections happen through `/cancel`, which writes a
*reversing* entry.

### 3.6 Reports

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

### 3.7 Portal — Contact role only

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/portal/documents` | The caller's own invoices **and** bills, paginated |
| `GET` | `/portal/documents/{id}` | Detail — 404 (never 403) if it isn't theirs |
| `POST` | `/portal/payments` | Pay one of their own documents |

> Returning **404 rather than 403** for another contact's document is deliberate: a 403
> confirms the record exists, which leaks information across tenants.

### 3.8 SSE events

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
| `ALLOCATION_MISMATCH` | 422 | `Σ allocations ≠ payment.amount` | `services/payments.py` |
| `DUPLICATE_PAYMENT` | 409 | `Idempotency-Key` already used — returns the original payment | `routers/payments.py` |
| `INVALID_JOURNAL_TYPE` | 422 | Payment journal is not `BANK` or `CASH` | `services/payments.py` |
| `CONTACT_TYPE_MISMATCH` | 422 | A vendor on a sales document, or a customer on a purchase | `services/rules.py` |
| `BUDGET_PERIOD_INVALID` | 422 | `period_end <= period_start` | `schemas/domain.py` |

`fields` keys match request body field names exactly, so the UI drops each message
straight into the matching input.

**Add a row the moment you invent a code.** Last round this table was left empty and the
frontend guessed.

---

## 5. CONTRACT CHANGE PROTOCOL

1. Edit this file **first**
2. Say it out loud to the room (or in the group chat) — one line: *"changing X to Y"*
3. Then change the backend
4. Frontend updates `lib/api.ts` types to match

The QA owner (Card D) polices drift. A contract change that isn't announced is how you get a
frontend calling an endpoint that no longer exists at 23:00.
