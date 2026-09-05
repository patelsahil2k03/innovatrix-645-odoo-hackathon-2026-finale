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
| `address_city` / `address_state` | String(80) | |
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
| `category` | String(80) | indexed |
| `sales_tax_pct` | Numeric(5,2) | default 0, `CHECK 0..100` |
| `income_account_id` | FK → `accounts.id` | where a sale credits |
| `expense_account_id` | FK → `accounts.id` | where a purchase debits |
| `is_archived` | Boolean | |

### `accounts` — Chart of Accounts
| Column | Type | Notes |
|---|---|---|
| `code` | String(20) | **unique**, indexed — sorts the reports |
| `name` | String(120) | required |
| `type` | Enum(`ASSET`,`LIABILITY`,`EQUITY`,`INCOME`,`EXPENSE`) | indexed |
| `is_archived` | Boolean | archived accounts reject new postings |

> The statement says **"Capital"**; we store it as `EQUITY` and *label* it Capital in the
> UI. Accounting convention and the balance-sheet grouping both want `EQUITY`.

**Normal balance** is derived from `type`, never stored:
`ASSET`, `EXPENSE` → debit-positive · `LIABILITY`, `EQUITY`, `INCOME` → credit-positive.

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

A **dimension**, not a ledger account. It tags journal lines so a budget can be measured
without distorting the Chart of Accounts.

### `budgets` / `budget_lines`
| `budgets` | Type |
|---|---|
| `name` | String(120) |
| `period_start` / `period_end` | Date, `CHECK period_end > period_start` |
| `responsible_user_id` | FK → `users.id` |

| `budget_lines` | Type |
|---|---|
| `budget_id` | FK, indexed |
| `analytic_account_id` | FK, indexed |
| `planned_amount` | Numeric(12,2), `CHECK >= 0` |
| | `UNIQUE(budget_id, analytic_account_id)` |

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

All four document headers share a shape: `number` (unique), a `status` enum, a date, a
contact FK, computed totals, and — once posted — a `journal_entry_id`.

### Purchase chain
```
purchase_orders        number · vendor_id · order_date · status · total
  └ purchase_order_lines   product_id · quantity · unit_price
vendor_bills           number · po_id? · vendor_id · bill_date · due_date
                       · status · total · amount_paid · journal_entry_id
  └ vendor_bill_lines      product_id · quantity · unit_price · account_id
```

### Sales chain
```
sales_orders           number · customer_id · order_date · status · total
  └ sales_order_lines      product_id · quantity · unit_price · tax_pct
customer_invoices      number · so_id? · customer_id · invoice_date · due_date
                       · status · untaxed_total · tax_total · total
                       · amount_paid · journal_entry_id
  └ customer_invoice_lines product_id · quantity · unit_price · tax_pct · account_id
```

Every line: `CHECK (quantity > 0)` and `CHECK (unit_price >= 0)`.
`amount_paid` is a **cached** figure for list screens and status transitions only — it is
never what a report reads.

### `payments`
| Column | Type | Notes |
|---|---|---|
| `number` | String(32) | unique |
| `contact_id` | FK | indexed |
| `direction` | Enum(`INBOUND`,`OUTBOUND`) | inbound = customer paying us |
| `journal_id` | FK → `journals.id` | must be a `BANK` or `CASH` journal |
| `amount` | Numeric(12,2) | `CHECK > 0` |
| `payment_date` | Date | |
| `journal_entry_id` | FK | |
| `idempotency_key` | String(64) | **unique** — the double-click guard |

### `payment_allocations`
`payment_id` FK · `invoice_id` FK? · `bill_id` FK? · `amount` Numeric(12,2) `CHECK > 0`

```sql
CHECK ((invoice_id IS NULL) <> (bill_id IS NULL))   -- exactly one target
```

One payment can settle several documents; one document can receive several payments. The
service enforces that `Σ allocations ≤ document.total` and that
`Σ allocations = payment.amount`.

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
| Balance Sheet | group by `account.type ∈ {ASSET, LIABILITY, EQUITY}`, signed by normal balance |
| Profit & Loss | group by `account.type ∈ {INCOME, EXPENSE}` within the period |
| Trial balance | `Σ debit − Σ credit` over everything — **must equal 0.00** |
| Budget report | `planned_amount` vs `Σ journal_lines` filtered by `analytic_account_id` and period |

Retained earnings on the Balance Sheet = the P&L net figure for the period. Assets must
equal Liabilities + Equity; if it doesn't, the trial balance badge already said so.

### Entry numbering — gapless, and why it matters
Format `{JOURNAL_CODE}/{YYYY}/{00001}`, allocated **inside the posting transaction** with
a row lock on a sequence row — not `MAX(entry_number)+1`, which races. A gap in an
accounting sequence is an audit finding in real systems, and gap detection is a cheap,
genuinely impressive report.

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
1000 Cash              ASSET       2000 Creditors        LIABILITY
1010 Bank              ASSET       2100 Tax Payable      LIABILITY
1100 Debtors           ASSET       3000 Capital          EQUITY
                                   4000 Sales Income     INCOME
                                   5000 Purchase Expense EXPENSE
```

**Seed the edge cases you intend to demo**, or you cannot show the rule working:
- an invoice **partially** paid, so `PARTIAL` status is visible
- an invoice fully paid and one still open, past its due date
- an **archived** account, to demo the posting rejection
- a budget deliberately **over** its planned amount, so the variance is red
- at least one contact who is `BOTH` customer and vendor

Keep it deterministic (`Gen(42)`). The demo you rehearse is the demo you present.

---

## 9. WHAT'S ALREADY IN THE DATABASE

`roles`, `users`, `audit_logs`, `notifications` — built, tested, seeded. Don't rebuild
them. Reference `users.id` for `budgets.responsible_user_id` and `posted_by_id`.

The three roles seed as **Admin**, **Accountant**, **Contact** — see
[`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md) §2 for the permission split.
