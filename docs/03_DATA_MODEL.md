# 03 — DATA MODEL

> **Owner:** Backend Core, with the whole team present for the first 20 minutes.
> **Status:** locked against [`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md).
> **Money is `Numeric(12,2)` everywhere. Dates are `DateTime(timezone=True)`, always UTC.**

---

## 1. THE SHAPE OF IT

Two document chains, one ledger. Everything converges on `journal_entries`.

```
 MASTER DATA                DOCUMENTS                      THE LEDGER
 ───────────                ─────────                      ──────────
 contacts ──────┐    purchase_orders                 ┌─► journal_entries
 products ──────┤           │ confirm                │        │ 1..n
 accounts ──────┼──►  vendor_bills ──── post ────────┤        ▼
 journals ──────┤           │                        │   journal_lines
 analytic_accts ┤           ▼                        │        │
 budgets ───────┘       payments ───── post ─────────┤        │
                            ▲                        │        ▼
                 customer_invoices ─── post ─────────┘   ┌─────────────┐
                            ▲ generate                   │  REPORTS    │
                      sales_orders                       │ BS · P&L ·  │
                            ▲ confirm                    │ Budget      │
                        (customer)                       └─────────────┘
```

**The single rule that defines this system:** documents never store a balance that a
report reads. Documents *post* into the ledger; reports *aggregate* the ledger.

---

## 2. MASTER DATA

### `contacts`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | `UUIDMixin` |
| `name` | String(120) | required |
| `type` | Enum(`CUSTOMER`,`VENDOR`,`BOTH`) | `native_enum=False`, indexed |
| `email` | String(180) | unique where not null — portal login identity |
| `mobile` | String(20) | |
| `address_street` | String(180) | |
| `address_city` / `address_state` | String(80) | |
| `address_country` | String(80) | default `India` — the mockup draws this field |
| `address_pincode` | String(10) | |
| `image_url` | String(400) | nullable |
| `receivable_account_id` | FK → `accounts.id` | nullable; defaults to the system Debtors account |
| `payable_account_id` | FK → `accounts.id` | nullable; defaults to the system Creditors account |
| `is_archived` | Boolean | default `false`, indexed |

The two account FKs are what let a document post itself without the user picking accounts
by hand. Seed them from the Chart of Accounts.

### `products`
| Column | Type | Notes |
|---|---|---|
| `name` | String(160) | required |
| `type` | Enum(`GOODS`,`SERVICE`,`COMBO`) | |
| `sales_price` | Numeric(12,2) | `CHECK >= 0` |
| `cost_price` | Numeric(12,2) | `CHECK >= 0` |
| `category_id` | FK → `product_categories.id` | indexed. **Not a string** — see below |
| `sales_tax_pct` | Numeric(5,2) | default 0, `CHECK 0..100` |
| `income_account_id` | FK → `accounts.id` | where a sale credits |
| `expense_account_id` | FK → `accounts.id` | where a purchase debits |
| `is_archived` | Boolean | |

### `product_categories`
`name` String(80) **unique** · `is_archived`

A table, not a string column. The mockup notes *"Category can be created and saved on the
fly (Many2one Field)"* — so the product form offers a combobox that creates a category
inline when the typed value doesn't exist yet.

### `accounts` — Chart of Accounts
| Column | Type | Notes |
|---|---|---|
| `code` | String(20) | **unique**, indexed — sorts the reports |
| `name` | String(120) | required |
| `type` | Enum — **eight values, see below** | indexed |
| `is_archived` | Boolean | archived accounts reject new postings |

**The eight account types**, taken from the mockup rather than the PDF:

| Type | Rolls up to | Example accounts |
|---|---|---|
| `ASSET` | Balance Sheet — Assets | Debtors |
| `BANK` | Balance Sheet — Assets | Bank |
| `CASH` | Balance Sheet — Assets | Cash |
| `LIABILITY` | Balance Sheet — Liabilities | Creditors |
| `CAPITAL` | Balance Sheet — Liabilities | Capital |
| `INCOME` | Profit & Loss | Sales Income |
| `EXPENSE` | Profit & Loss | Purchase Expense |
| `OTHER_EXPENSE` | Profit & Loss — **its own line** | Other Expense |

> ⚠️ **Three corrections against an earlier reading.** The PDF lists five types; the mockup
> uses eight. `BANK` and `CASH` are **types**, not named accounts — which is what lets the
> Balance Sheet list them separately without hard-coding account names. `OTHER_EXPENSE` is
> distinct from `EXPENSE` because the P&L reports them on separate lines. And the statement's
> **"Capital"** is stored as `CAPITAL`, not `EQUITY` — the mockup uses the word throughout,
> and matching the evaluator's vocabulary costs nothing.

**Normal balance** is derived from `type`, never stored:
`ASSET`, `BANK`, `CASH`, `EXPENSE`, `OTHER_EXPENSE` → debit-positive ·
`LIABILITY`, `CAPITAL`, `INCOME` → credit-positive.

> **One ambiguity worth naming.** The mockup's type dropdown lists five options while its
> Balance Sheet notes read like sub-types (`Asset-Bank`, `Asset-Debtors`). Eight flat types
> satisfies both readings and keeps the reports simple. If it turns out to mean a two-level
> taxonomy, only the grouping query changes — no table does.

### `journals`
| Column | Type | Notes |
|---|---|---|
| `name` | String(80) | required |
| `type` | Enum(`SALES`,`PURCHASE`,`BANK`,`CASH`,`MISC`) | indexed |
| `default_debit_account_id` | FK → `accounts.id` | for BANK/CASH this *is* the money account |
| `default_credit_account_id` | FK → `accounts.id` | |
| `is_archived` | Boolean | |

### `analytic_accounts`
`name` String(120) · `type` Enum(`INCOME`,`EXPENSE`) · `is_archived`

A **dimension**, not a ledger account. It tags **document lines** so a budget can be measured
without distorting the Chart of Accounts.

> ⚠️ **Corrected.** An earlier version of this document said analytic tags sit on journal
> lines. They sit on **invoice, bill and order lines** — the mockup draws a *Budget Analytics*
> column on every document line table, and describes achievement as *"search Analytical in
> Sales Invoice … consider budget period and compute total"*. Tagging journal lines instead
> would be defensible accounting and the wrong answer to the specification. Journal lines keep
> a nullable analytic column for future reporting, but nothing computes from it today.

### `budgets` — with a revision chain
| Column | Type | Notes |
|---|---|---|
| `name` | String(120) | on revision: original name + `" Revised"` |
| `period_start` / `period_end` | Date | `CHECK period_end > period_start` |
| `responsible_id` | FK → `contacts.id` | the mockup selects from **contacts**, not users |
| `state` | Enum(`DRAFT`,`CONFIRMED`,`REVISED`,`CANCELLED`) | indexed |
| `revision_of_id` | FK → `budgets.id` | set on the successor — "Revision Of" link |
| `revised_with_id` | FK → `budgets.id` | set on the original — "Revised With" link |

### `budget_lines`
| Column | Type | Notes |
|---|---|---|
| `budget_id` | FK, indexed | |
| `analytic_account_id` | FK, indexed | |
| `committed_amount` | Numeric(12,2), `CHECK >= 0` | **the only stored figure** |
| | | `UNIQUE(budget_id, analytic_account_id)` |

**Achieved, Achieved % and Amount-to-achieve are computed on read**, never stored:

```
achieved      = Σ document_line.total
                WHERE analytic_account_id = line.analytic_account_id
                  AND document.date BETWEEN budget.period_start AND period_end
                  AND source = invoices if analytic.type = INCOME
                             , bills    if analytic.type = EXPENSE
achieved_pct  = achieved ÷ committed × 100
to_achieve    = committed − achieved
```

**The revision workflow.** A `CONFIRMED` budget is never edited. `Revise` creates a new
budget carrying the original's lines, moves the original to `REVISED`, and links the two in
both directions so either can be opened from the other. Same immutability instinct as the
ledger, applied to planning.

---

## 3. THE LEDGER — the two tables that carry the whole differentiator

### `journal_entries`
| Column | Type | Notes |
|---|---|---|
| `entry_number` | String(32) | **unique** — gapless sequence, see §5 |
| `journal_id` | FK → `journals.id` | indexed |
| `entry_date` | Date | indexed — reports filter on this |
| `reference` | String(120) | free text, e.g. the source document number |
| `state` | Enum(`DRAFT`,`POSTED`,`REVERSED`) | indexed |
| `source_type` | String(40) | `customer_invoice` · `vendor_bill` · `payment` · `manual` |
| `source_id` | UUID | nullable — the document that produced this |
| `reversal_of_id` | FK → `journal_entries.id` | set on a reversing entry |
| `posted_at` / `posted_by_id` | DateTime(tz) / FK users | |

`UNIQUE(source_type, source_id)` where state != `REVERSED` — one live entry per document.
This is the database-level guard against double-posting.

### `journal_lines`
| Column | Type | Notes |
|---|---|---|
| `entry_id` | FK → `journal_entries.id` | `ON DELETE CASCADE`, indexed |
| `account_id` | FK → `accounts.id` | indexed — **every report groups by this** |
| `analytic_account_id` | FK | nullable, indexed — drives the budget report |
| `partner_id` | FK → `contacts.id` | nullable — enables aged receivables |
| `label` | String(200) | what shows in the drill-down |
| `debit` | Numeric(14,2) | default 0 |
| `credit` | Numeric(14,2) | default 0 |

**Constraints — these are the system, not decoration:**

```sql
CHECK (debit >= 0 AND credit >= 0)                       -- no negative postings
CHECK (NOT (debit > 0 AND credit > 0))                   -- a line is one-sided
CHECK (debit > 0 OR credit > 0)                          -- no empty lines
```

And the entry-level invariant, asserted in `services/rules.py` inside the posting
transaction, before commit:

```python
if sum(l.debit for l in lines) != sum(l.credit for l in lines):
    raise AppError("UNBALANCED_ENTRY", ...)
```

> A CHECK constraint cannot see sibling rows, so the balance rule lives in the service —
> but it runs inside the same transaction as the insert, so a failure rolls the whole
> posting back. It is never possible to commit an unbalanced entry.

---

## 4. DOCUMENTS

All four document headers share a shape: a generated `number` (unique), a user-supplied
`reference`, a `status` enum, a date, a contact FK, computed totals, and — once posted — a
`journal_entry_id`.

> **`number` and `reference` are two different things.** `number` is ours, generated and
> gapless (`INV/2026/0042`). `reference` is theirs — free alphanumeric text like
> `ABC-26-001`, the customer's own PO number. The mockup shows both fields on every document.

### Purchase chain
```
purchase_orders        number · reference · vendor_id · order_date · status · total
  └ purchase_order_lines   product_id · analytic_account_id · account_id
                           · quantity · unit_price
vendor_bills           number · reference · po_id? · vendor_id · bill_date · due_date
                       · status · total · amount_paid · journal_entry_id
  └ vendor_bill_lines      product_id · analytic_account_id · account_id
                           · quantity · unit_price
```

### Sales chain
```
sales_orders           number · reference · customer_id · order_date · status · total
  └ sales_order_lines      product_id · analytic_account_id · account_id
                           · quantity · unit_price · tax_pct
customer_invoices      number · reference · so_id? · customer_id · invoice_date · due_date
                       · status · untaxed_total · tax_total · total
                       · amount_paid · journal_entry_id
  └ customer_invoice_lines product_id · analytic_account_id · account_id
                           · quantity · unit_price · tax_pct
```

**Every line carries `analytic_account_id`** — that column is what the budget report reads.
It is nullable, because not every line belongs to a budgeted project.

**`po_id` and `so_id` are nullable on purpose.** The mockup notes that the link back to the
order shows *"only if bill created from PO — hide if bill created fresh without PO"*. Both
documents can be raised standalone.

Every line: `CHECK (quantity > 0)` and `CHECK (unit_price >= 0)`.
`amount_paid` is a **cached** figure for list screens and status transitions only — it is
never what a report reads.

### `payments`
| Column | Type | Notes |
|---|---|---|
| `number` | String(32) | unique |
| `contact_id` | FK | indexed — autofilled from the source document |
| `direction` | Enum(`RECEIVE`,`SEND`) | the mockup's own words for inbound / outbound |
| `journal_id` | FK → `journals.id` | must be a `BANK` or `CASH` journal; **defaults to Bank** |
| `amount` | Numeric(12,2) | `CHECK > 0` — autofilled with the amount due |
| `payment_date` | Date | defaults to today |
| `note` | String(200) | free text — the mockup draws this field |
| `invoice_id` / `bill_id` | FK, nullable | `CHECK` exactly one is set |
| `journal_entry_id` | FK | |
| `idempotency_key` | String(64) | **unique** — the double-click guard |

```sql
CHECK ((invoice_id IS NULL) <> (bill_id IS NULL))   -- exactly one target
```

> ⚠️ **Simplified from an earlier design.** This previously had a `payment_allocations`
> join table so one payment could settle several documents. The mockup does not work that
> way: payment is raised from a **single document's** Pay button, with partner and amount
> pre-filled from it. One payment, one target. Partial payment is expressed by entering less
> than the amount due, not by splitting across documents.
>
> The join table would not be wrong — it is how a fuller system works — but it is scope we
> were not asked for, and it complicates the one screen that has to be flawless.

The service enforces `amount ≤ document.total − document.amount_paid`, raising
`OVERALLOCATED_PAYMENT` otherwise, then moves the document to `PARTIAL` or `PAID`.

---

## 5. POSTING RULES — memorise these four

This is the entire accounting engine. Everything else is CRUD.

**Customer Invoice posted**
```
Dr  Accounts Receivable (contact.receivable_account)     total
    Cr  Sales Income (product.income_account)              untaxed_total
    Cr  Tax Payable                                        tax_total
```

**Vendor Bill posted**
```
Dr  Purchase Expense (product.expense_account)           per line
    Cr  Accounts Payable (contact.payable_account)         total
```

**Customer Payment (INBOUND)**
```
Dr  Bank / Cash (journal.default_debit_account)          amount
    Cr  Accounts Receivable                                amount
```

**Vendor Payment (OUTBOUND)**
```
Dr  Accounts Payable                                     amount
    Cr  Bank / Cash                                        amount
```

**Reports are then pure aggregation over `journal_lines`:**

| Report | Query |
|---|---|
| Balance Sheet | group by `account.type ∈ {ASSET, BANK, CASH, LIABILITY, CAPITAL}`, signed by normal balance |
| Profit & Loss | group by `account.type ∈ {INCOME, EXPENSE}` within the period |
| Trial balance | `Σ debit − Σ credit` over everything — **must equal 0.00** |
| Budget report | `planned_amount` vs `Σ journal_lines` filtered by `analytic_account_id` and period |

Retained earnings on the Balance Sheet = the P&L net figure for the period. Assets must
equal Liabilities + Equity; if it doesn't, the trial balance badge already said so.

### Numbering — the exact formats the mockup uses

| Document | Format | Example |
|---|---|---|
| Customer invoice | `INV/{YYYY}/{0000}` | `INV/2026/0042` |
| Vendor bill | `Bill/{YYYY}/{0000}` | `Bill/2026/0001` |
| Sales order | `S{00000}` | `S00001` |
| Purchase order | `P{00000}` | `P00001` |

> Orders use a short running number; posted documents carry the year. Match these exactly —
> a number format is the cheapest possible fidelity signal, and the evaluator drew them.

Every number is allocated **inside the transaction** while holding a row lock on a sequence
row — never `MAX(number)+1`, which races two concurrent confirms into the same value. The
result is gapless, which matters because a gap in an accounting sequence is an audit finding
in real systems, and gap detection is a cheap, genuinely impressive report.

---

## 6. RULES FOR EVERY TABLE (carried forward)

- **`UUIDMixin`** always. **`TimestampMixin`** whenever a row can be edited later.
- **Unique constraints** on everything the statement calls unique: account code, all
  document numbers, contact email, `payments.idempotency_key`.
- **CHECK constraints** for every numeric rule. A rule enforced by the database cannot be
  bypassed by a bug in a route handler — and it demonstrates real data modelling.
- **Index** every column you filter or sort by: `status`, all FKs, all dates.
- **Status columns use a Python `Enum` with `native_enum=False`.**
- **Money** is `Numeric(12,2)`. Never `Float` — rounding drift is visible on screen.
- **Dates**: `DateTime(timezone=True)`, always UTC. Never mix `date.today()` with
  `datetime.now(UTC)` — that broke three tests on every IST machine last round.

---

## 7. MIGRATIONS

```bash
cd backend
uv run alembic revision --autogenerate -m "add accounting core"
uv run alembic upgrade head
uv run alembic check
```

1. **Autogenerate only sees imported models.** Add every new model to
   `models/__init__.py` or Alembic generates an empty migration.
2. **Read the generated migration before applying it** — especially the CHECK constraints
   above, which autogenerate handles inconsistently across backends.

---

## 8. SEED DATA — worth more than it looks

A ledger with four rows reads as unfinished; the same ledger with a real month of trading
reads as a product. Generators already exist (`seed/generators.py`: Indian names, cities,
phone numbers, dates).

**Volume target:** ~20 contacts · ~25 products · ~30 purchase documents · ~40 sales
documents · ~60 payments — enough that pagination, search and sorting are visibly
meaningful, and the reports show real figures rather than round test numbers.

**A minimal Chart of Accounts must be seeded** or nothing can post:

```
code  name              type            code  name               type
1000  Cash              CASH            2000  Creditors          LIABILITY
1010  Bank              BANK            2100  Tax Payable        LIABILITY
1100  Debtors           ASSET           3000  Capital            CAPITAL
                                        4000  Sales Income       INCOME
                                        5000  Purchase Expense   EXPENSE
                                        5100  Other Expense      OTHER_EXPENSE
```

The mockup says these *"are to be pre configured"*, so they are seeded rather than left for
the user to invent. `Other Expense` earns its row because the Profit & Loss statement reports
it on a separate line from `Purchase Expense`.

**Seed the edge cases you intend to demo**, or you cannot show the rule working:
- an invoice **partially** paid, so `PARTIAL` status is visible
- an invoice fully paid and one still open, past its due date
- an **archived** account, to demo the posting rejection
- a budget deliberately **over** its planned amount, so the variance is red
- at least one contact who is `BOTH` customer and vendor

Keep it deterministic (`Gen(42)`). The demo you rehearse is the demo you present.

---

## 9. WHAT'S ALREADY IN THE DATABASE — and what changes

`roles`, `users`, `audit_logs`, `notifications` — built, tested, seeded. Don't rebuild them.
Reference `users.id` for `posted_by_id`.

The three roles seed as **Admin**, **Accountant**, **User** — see
[`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md) §2 for the permission split.

### `users` gains three things for self-registration

The mockup includes a **Sign Up** page, which the earlier design did not account for.

| Column | Type | Notes |
|---|---|---|
| `login_id` | String(12) | **unique** · `CHECK length between 6 and 12` |
| `contact_id` | FK → `contacts.id` | nullable — set for portal users, null for staff |
| `role_id` | FK → `roles.id` | self-registration always creates an **Accountant** |

**Credential rules, taken verbatim from the mockup and enforced server-side:**

- Login ID unique, 6–12 characters
- Email must not already exist
- Password: more than 8 characters, and must contain a lowercase letter, an uppercase letter
  and a special character

> Mirror these in `validation.ts` so the user sees them inline as they type — but the server
> is the boundary, and both layers must agree on the exact rules.

`contact_id` is what makes portal scoping possible: a `User` sees documents where
`customer_id = current_user.contact_id`, and nothing else.
