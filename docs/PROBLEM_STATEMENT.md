# PROBLEM STATEMENT — Urban Furniture: Accounting System

> **There are two authoritative sources, and they are not equally detailed.**
>
> 1. **The PDF** — [`Urban Furniture Accounting System.pdf`](Urban%20Furniture%20Accounting%20System.pdf),
>    kept alongside this file. Transcribed in §1 below for grep-ability.
> 2. **The Excalidraw flow** — linked at the end of the PDF, and **considerably more
>    specific**. It defines the screens, the fields, the exact number formats, the account
>    types, and the budget behaviour, none of which the PDF fully describes.
>
> **If this file disagrees with either, they win.** Where the PDF and the mockup disagree,
> the mockup is more specific and we follow it — §3 lists every such case rather than
> resolving them silently.

---

## 1. Official statement

### Overview

An accounting system for Urban Furniture that enables:

- Entry of core master data (Contacts, Products, Chart of Accounts, Budget, Journals)
- Smooth recording of sales, purchases, and payments using the master data.
- Automated generation of financial and stock reports like Balance Sheet, Profit & Loss
  (P&L), and Budget Report.

### Primary Actors

- **Admin (Business Owner)** — Creates / Modify / Archived Master Data, Record Transaction
  and View Report
- **Invoicing User (Accountant)** — Creates Master Data, Records Transactions, Views Reports.
- **Contact** — Contact users can be created when creating Contact Master data. Only view
  their own invoice/bills and make payment.
- **System** — Validates data, computes taxes, updates ledgers, and generates reports

### Master Data Modules

**1. Contact Master** — Fields: Name, Type (Customer/Vendor/Both), Email, Mobile, Address
(City, State, Pincode), Profile Image.
Example: Vendor — Rahul Sharma · Customer — Nimesh Pathak

**2. Product Master** — Fields: Product Name, Type (Goods/Service/combo), Sales Price, Cost
(Purchase Price), Category.
Example: Office Chair, Wooden Table, Sofa, Dining Table.

**3. Chart of Accounts Master** — the master list of all ledger accounts used to classify
every financial transaction. Each account acts like a category or bucket where related
transactions are grouped (e.g. Cash, Bank, Sales Income, Purchase Expense).
Fields: Account Name, Type (Asset, Liability, Expense, Income, Capital).
Example: Assets — Cash, Bank, Debtors · Liabilities — Creditors · Income — Sale Income ·
Expenses — Purchases Expense

**4. Journal** — a record or book used to group and organize similar accounting
transactions. Each journal represents a specific type of financial activity.
Fields: Journal Name, Type, Default Accounts.
Example: Sales Journal, Purchase Journal, Bank Journal, Cash Journal

**5. Journal Entries** — the actual accounting record created for a financial transaction.
It records the debit and credit accounts along with the amount, **ensuring that every
transaction follows the double-entry accounting principle**.
Fields: Journal, Date, Reference, Journal Items, Account, Debit, Credit.
Example: Cash received from customer → Debit: Cash, Credit: Debtor ·
Purchase made on credit → Debit: Purchase Expense, Credit: Creditor

### Transaction Flow

| Process | Fields / Details |
|---|---|
| Purchase Order | Select Vendor, Product, Quantity, Unit Price |
| Vendor Bill | Convert PO to Bill, record invoice date, due date, and register payment (Cash/Bank) |
| Sales Order | Select Customer, Product, Quantity, Unit Price, Tax |
| Customer Invoice | Generate Invoice from SO and receive payment via Cash/Bank |
| Payment | Register against bill/invoice — select bank or cash |

### Budget Flow

**Analytic Account** — a financial marker to monitor and group expenses or income related
to a particular project, department, or business unit. Provides the foundation for
evaluating the fiscal success of that specific sector.
Fields: Analytic Account name, Type (Income/Expenses)

**Budget** — created by defining the budget period, planned amount, and the relevant
analytic account.
Fields: Budget Name, Period, Responsible Person

### Reporting Requirements

After transactions are recorded, the system must generate:

1. **Balance Sheet** — Real-time snapshot of Assets, Liabilities, and Capital.
2. **Profit & Loss Account** — Income from product sales minus purchases/expenses to show
   net profit.
3. **Budget Report** — Provides an overview of the planned budget.

### Key Use-Case Steps

**7.1 Create Master Data** — User creates and maintains the required master data; adds
Contacts such as Azure Furniture and Nimesh Pathak; adds Products such as Wooden Chair;
sets up the Chart of Accounts.

**7.2 Record a Purchase** — User creates a Purchase Order for Azure Furniture. Once the
goods are received, the user converts the Purchase Order into a Vendor Bill. User records
the payment through Bank.

**7.3 Record a Sale** — User creates a Sales Order for Nimesh Pathak for 5 Office Chairs.
User generates a Customer Invoice. User records the payment through Cash/Bank.

**7.4 Generate Reports** — User selects the reporting period. The system generates the
Balance Sheet (company's assets and liabilities), the Profit & Loss Report (total sales,
purchases, expenses, and net profit), and the Budget Report.

### Why This Hackathon Problem is Important

- **Real-world accounting workflow:** shows how a complete accounting process works
  end-to-end (Master Data → Purchase/Sales → Invoice/Bill → Payment → Accounting Entries →
  Reporting).
- **Business logic focus:** handling practical accounting rules like debit/credit entries,
  payment tracking, account classification, budgets, and financial report generation — not
  just UI screens.
- **Industry-ready system thinking:** builds a production-like solution connecting contacts,
  products, journals, transactions, budgets, and financial reports while maintaining
  accurate and consistent accounting data.

**Mockup:** https://app.excalidraw.com/s/65VNwvy7c4X/6ofCsWuwhe

---

## 2. Team's first-pass triage

### Actors / roles

| Role | Master data | Transactions | Reports | Notes |
|---|---|---|---|---|
| **Admin** (Business Owner) | create · modify · archive | ✅ | ✅ | The only role that may modify or archive masters |
| **Accountant** (Invoicing User) | create only | ✅ | ✅ | **Cannot** modify or archive — this is the real RBAC line |
| **Contact** (portal) | — | pay own documents | — | Sees only their own invoices/bills. Hard data-scoping rule. |

> The Admin/Accountant split is genuinely tested by the statement's own wording. Read
> "Creates Master Data" (Accountant) against "Creates/Modify/Archived Master Data" (Admin).

### Core entities (→ tables)

Contact · Product · Account (Chart of Accounts) · Journal · **Journal Entry + Journal
Line** · Purchase Order · Vendor Bill · Sales Order · Customer Invoice · Payment ·
Analytic Account · Budget

Full schema with columns, constraints and indexes: [`03_DATA_MODEL.md`](03_DATA_MODEL.md).

### Core flows (→ endpoints & screens)

1. Master data CRUD (5 modules)
2. **Purchase:** PO → confirm → Vendor Bill → post → Payment
3. **Sale:** SO → confirm → Customer Invoice → post → Payment
4. **Posting:** every posted document emits one balanced journal entry
5. **Reporting:** Balance Sheet · P&L · Budget, all computed from the ledger
6. **Portal:** contact views own documents and pays

### The state machine

There are two parallel document chains and **one ledger they both feed**:

```
Purchase Order  DRAFT → CONFIRMED → BILLED → (CANCELLED)
Vendor Bill     DRAFT → POSTED → PARTIAL → PAID → (CANCELLED)
Sales Order     DRAFT → CONFIRMED → INVOICED → (CANCELLED)
Customer Invoice DRAFT → POSTED → PARTIAL → PAID → (CANCELLED)
Journal Entry   DRAFT → POSTED → (REVERSED)     ← immutable once POSTED
```

**The spine is the Journal Entry.** Both chains converge on it, and every report reads
from it alone.

### Business rules — every "must" / "cannot" / "automatically"

1. Every journal entry **must** balance: `Σ debit = Σ credit`. Enforced in the database.
2. A journal line is one-sided — it **cannot** carry both a debit and a credit.
3. A posted entry **cannot** be edited or deleted. Corrections create a *reversing* entry.
4. Posting a document **automatically** generates its journal entry — never by hand.
5. Reports **must** aggregate journal lines, and **cannot** sum documents.
6. A payment allocation **cannot** exceed the remaining balance of the target document.
7. A document **cannot** be posted twice (idempotent posting).
8. An archived account **cannot** receive new postings.
9. A Contact **cannot** see another contact's documents.
10. An Accountant **cannot** modify or archive master data.
11. Converting a PO to a Bill **must** copy lines faithfully and mark the PO `BILLED`.
12. Tax on a sale **must** be computed by the system, not typed by the user.
13. A document **cannot** be posted or confirmed with zero lines.
14. A document with any payment already recorded against it **cannot** be cancelled — a
    partial or full refund is a reversing correction, never a raw cancel of paid history.
15. Tax is computed **per line**, rounded to two decimals per line, then summed — never
    computed once on the order subtotal, which can round to a different total by a paisa.
16. A line's tax rate and account mapping are captured **at the moment the line is
    created**, and never re-derived from the product's current settings afterward — a later
    rate change must not retroactively alter an existing document.
17. Archiving a contact, product, or account **cannot** affect any document or ledger entry
    that already references it — archiving only blocks new use, never rewrites history.

Rules 13–17 were found by cross-checking the schema for edge cases neither official source
states explicitly but that a real accounting system cannot skip — a document editor that
allows zero lines, or a cancel button that quietly orphans a recorded payment, would pass
every example in the statement while still being wrong.

Each of these gets a rejecting test **and** an accepting test — see
[`07_TESTING_AND_REVIEW.md`](07_TESTING_AND_REVIEW.md).

### Mandatory deliverables (explicitly required)

All nine are **built and verified end to end against the running system** — each line
below names the evidence rather than asserting completion.

- [x] Contact, Product, Chart of Accounts, Journal, Journal Entry master data — 21
      contacts, 25 products, 9 live accounts, 4 journals, 109 entries; list, create and
      edit screens for each
- [x] Purchase Order → Vendor Bill → Payment — driven through the API end to end:
      `P00031 → Bill/2026/0024 → PAID`, balance due 0.00
- [x] Sales Order → Customer Invoice → Payment (with tax) — `S00042 → INV/2026/0033 →
      PAID`; tax is computed per line by the server and never accepted from the request
      (`test_sales_chain_posts_a_balanced_entry_and_settles`)
- [x] Analytic Account + Budget — 6 analytic accounts, 3 budgets with the
      `DRAFT → CONFIRMED → REVISED → CANCELLED` state machine
- [x] Balance Sheet — assets 37,68,761.00 = liabilities 12,98,461.00 + retained earnings
      24,70,300.00, `is_balanced: true`
- [x] Profit & Loss — income, expenses and other expenses reported separately, PDF export
- [x] Budget Report — planned against achieved per line, from the ledger
- [x] Contact portal — view own documents, make payment — a portal login sees only its own
      documents and settles them from the portal
- [x] Three roles enforced server-side — 3 roles × 18 endpoints verified, every allow and
      every 403 as intended

### Bonus / optional (not asked for — build only after the above is green)

- [ ] **Advance / deposit payments** — recording money against a Purchase or Sales Order
      *before* a Bill or Invoice exists. Not asked for by either source, and the current
      schema deliberately doesn't support it — see [`03_DATA_MODEL.md`](03_DATA_MODEL.md)
      §4 for exactly what's missing and how it would be added if wanted.
- [x] Drill-down: report figure → account → journal lines → source document — a balance
      sheet row opens the entries behind it (`/journal-entries?account_id=…`), and each
      entry carries `source_type` + `source_id` through to the document that created it
- [x] Aged receivables / payables — 0–30 · 31–60 · 61–90 · 90+, receivables against
      payables, on the dashboard. The buckets reconcile with the outstanding balance
      (`test_ageing_buckets_account_for_every_outstanding_rupee`)
- [ ] Period lock (a closed month cannot be posted into)

> Partial payment itself is **not** on this list — entering less than the amount due is
> already core, mandatory behaviour (§1, "Payment" row). The item above is specifically
> about paying *before any bill or invoice exists at all*, which is a different, harder
> problem: there is no document yet for the payment to point at.

### 🟩 The capability that defines the build

**A live, drill-down Balance Sheet with a permanent `Trial balance 0.00 ✓` badge.**

Click any figure → the accounts behind it → the journal lines → the source document. The
badge asserts `Σ debit − Σ credit = 0` across the whole ledger and recomputes on every
posting, live over SSE.

It is first among equals because it is *load-bearing*: drill-down is only possible if the
ledger is real, so building it is what forces the rest of the design to stay honest. A system
that stores balances on documents cannot offer this path at all.

### ⬛ Explicitly out of scope (stated in the README)

- Multi-currency and FX gain/loss
- Bank reconciliation and statement import
- Recurring / deferred entries and accruals
- Fiscal-year closing entries
- Asset depreciation
- Inventory valuation and stock movements *(the statement says "stock reports" once in its
  overview but never defines a stock module — we implement the financial reports it
  actually specifies, and say so)*

### ⚠️ Traps spotted

| Trap | Why it bites | Mitigation |
|---|---|---|
| **"Stock reports" in the overview** | Named once, never specified — no warehouse, quantity-on-hand or valuation fields anywhere in the statement | Build the three specified financial reports; state the reading in the README rather than guessing a stock module |
| **Summing documents for reports** | Fast, looks right, silently wrong after a cancellation or credit | Reports read `journal_lines` only. Enforced by review. |
| **Float money** | Rounding drift shows up on screen in the demo | `Numeric(12,2)` everywhere, never `Float` |
| **Editing a posted invoice** | Breaks the audit trail and the ledger simultaneously | `POSTED` is immutable; corrections reverse |
| **Tax computed client-side** | Client and server disagree at the worst moment | Server computes; the client mirrors for display only |
| **Double-clicking "Register Payment"** | Two payments, ledger still balances, books are wrong | Idempotency key on payment creation |
| **`date.today()` vs `datetime.now(UTC)`** | Broke three tests on IST machines last round | UTC everywhere — [`10_LESSONS.md`](10_LESSONS.md) §8 |

---

## 3. DIFFERENTIATORS — 🟦 RECOMMENDED, NOT SCOPE

> **None of this is committed work.** Every item below is a *good-to-have*, and **nothing
> here starts until every box in §2 "Mandatory deliverables" is green and demoed.** They
> are written down so the choice is deliberate rather than improvised at hour eighteen —
> and so that if we cut them, we cut them knowingly.

**Why they are written down.** The specified system is master data, two document chains and
three reports. Everything below deepens that rather than widening it — each item makes the
accounting engine more visible or more useful, and none of it introduces a new subsystem.

### 3.1 Derived insight — deterministic, never a model

⚠️ **Deliberately not an LLM.** The organizers ask for solutions that *"plan for offline or
local; don't rely entirely on internet connectivity"* — a model call makes network
availability part of the product, and a confidently wrong statement about someone's accounts
is worse than no statement. Everything below is arithmetic over our own data, and **cites the
rows it came from**.

| # | Feature | What it does | Effort | Why it's worth it |
|---|---|---|---|---|
| 1 | **Duplicate bill detection** | Same vendor, amount within ±2%, within 7 days → warn before posting, linking the suspected original | Low | A real accounts-payable control. Duplicate-payment loss is a genuine business problem. |
| 2 | **Smart account suggestion** | Suggests the expense/income account from our own posting history: *"5000 Purchase Expense — used for 12 of the last 14 bills from this vendor"* | Low | A frequency count over the ledger. No library, no model, fully explainable. |
| 3 | **Amount anomaly flag** | z-score against that contact's own history: *"₹4,80,000 is 3.2σ above this vendor's average of ₹42,000"* | Low | Catches a mistyped amount before it is posted, which is when it is cheap to fix. |
| 4 | **Cash-flow forecast** | Projects the cash position 30/60/90 days out from open documents, due dates, and each customer's historical days-to-pay | Medium | Real treasury functionality, and pure arithmetic. |
| 5 | **Budget burn projection** | *"At the current rate this budget exceeds plan by ₹42,000 on 22 Sep"* | Low | Extends a **mandatory** deliverable rather than adding a surface — the best effort-to-value ratio here. |

**The principle:** no black box. Every flag explains itself in one sentence and cites the
rows behind it — which is also why we can defend each one line by line.

### 3.2 Interface

| # | Feature | What it does | Effort | Why it's worth it |
|---|---|---|---|---|
| 6 | **Posting preview (T-account)** | Before Confirm, show the exact journal entry that *will* be created, as the classic two-column T | Low | Makes the invisible half of the system visible, and proves the double-entry is real without a word of explanation. A bordered div. |
| 7 | **Keyboard-first entry** | ⌘K palette, tab-through line entry, Enter for a new line, ⌘⏎ to post | Medium | Accountants work at a keyboard all day. Designing for that is what separates a tool from a form. |
| 8 | **Dense data-grid aesthetic** | Right-aligned tabular numerals, debit and credit as two columns, hairline rules, no marketing cards | Low | Reads as professional finance software. Mostly one styling decision, made once. |

### 3.3 If only one gets built

**#6, the posting preview.** Lowest effort of the eight, and it demonstrates the single thing
that separates this from an invoice list with a balance sheet drawn on top.

Second: **#5, budget burn projection**, because it deepens something already required instead
of widening the surface area.

### 3.4 The rule

Ranked by *impact ÷ effort*, built strictly after the mandatory list is green, and **each
one either works or comes out**. A dashboard tile that promises "Cash Forecast" and renders
nothing is worse than no tile — that exact mistake is [`10_LESSONS.md`](10_LESSONS.md) §14.

---

## 4. WHAT THE MOCKUP ADDS TO THE PDF

The Excalidraw flow linked at the end of the statement is materially more specific than the
prose. These are requirements that exist **only** there — building from the PDF alone
produces the wrong system. Each is now reflected in the data model and API contract.

| # | Requirement | Where it lands |
|---|---|---|
| 1 | **Sign Up page** — self-registration creating an Accountant. Login ID unique 6–12 chars; password >8 with upper, lower and a special character | [`04_API_CONTRACT.md`](04_API_CONTRACT.md) §3.0 |
| 2 | **Eight account types** — `ASSET · BANK · CASH · LIABILITY · CAPITAL · INCOME · EXPENSE · OTHER_EXPENSE`. The PDF lists five. P&L reports Purchase Expense and Other Expense separately | [`03_DATA_MODEL.md`](03_DATA_MODEL.md) §2 |
| 3 | **Analytics on document lines**, not journal lines — every order, bill and invoice line carries a *Budget Analytics* column | [`03_DATA_MODEL.md`](03_DATA_MODEL.md) §2 |
| 4 | **Budget state machine** — `DRAFT → CONFIRMED → REVISED → CANCELLED`, with a linked revision chain and three computed columns per line | [`03_DATA_MODEL.md`](03_DATA_MODEL.md) §2 · [`06_BACKEND.md`](06_BACKEND.md) §6 |
| 5 | **Kanban views** alongside list views for Contact, Product, Analyticals and Budget | [`05_FRONTEND.md`](05_FRONTEND.md) §2.1 |
| 6 | **Print, PDF and email** on documents; PDF download on the P&L | [`01_STACK.md`](01_STACK.md) §3 · [`06_BACKEND.md`](06_BACKEND.md) §7 |
| 7 | **Number formats** — `INV/2026/0042`, `Bill/2026/0001`, `S00001`, `P00001` | [`03_DATA_MODEL.md`](03_DATA_MODEL.md) §5 |
| 8 | **Document reference** — user-supplied alphanumeric (`ABC-26-001`), separate from the generated number | [`03_DATA_MODEL.md`](03_DATA_MODEL.md) §4 |
| 9 | **Payment raised from a document** — direction Send/Receive, via Bank (default) or Cash, with a note | [`03_DATA_MODEL.md`](03_DATA_MODEL.md) §4 |
| 10 | **Product category is a table**, created inline from the product form | [`03_DATA_MODEL.md`](03_DATA_MODEL.md) §2 |
| 11 | **Image upload** on Contact and Product — a control, not a URL field | [`01_STACK.md`](01_STACK.md) §3 |
| 12 | **Four top-level menus** — Sales · Purchase · Account · Report, with Analyticals and Budget under Account | [`05_FRONTEND.md`](05_FRONTEND.md) §2 |
| 13 | **Bills and invoices can be raised without an order** — the back-link hides when there is none | [`03_DATA_MODEL.md`](03_DATA_MODEL.md) §4 |
| 14 | **Status counts on the dashboard** — All / Confirmed / Draft per module | [`05_FRONTEND.md`](05_FRONTEND.md) §2 |
| 15 | **Contact has a Country field** | [`03_DATA_MODEL.md`](03_DATA_MODEL.md) §2 |

**And one confirmation.** The mockup states our central invariant in its own words —
*"Blocking warning if the debit and credit amount don't match"*, and *"The Total of All asset
and liability would always match."* The double-entry guarantee is not our interpretation; it
is written on their canvas.
