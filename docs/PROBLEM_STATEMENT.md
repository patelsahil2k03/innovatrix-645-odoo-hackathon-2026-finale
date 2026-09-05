# PROBLEM STATEMENT — Urban Furniture: Accounting System

> **Selected.** Two alternatives (DealFlow360, PeoplePay360 HR & Payroll) were evaluated
> and rejected — the comparison is preserved in
> [`technicals/dealflow-vs-ledger.html`](technicals/dealflow-vs-ledger.html).
>
> **The authoritative source is the PDF**, kept alongside this file:
> [`Urban Furniture Accounting System.pdf`](Urban%20Furniture%20Accounting%20System.pdf).
> What follows is a faithful transcription for grep-ability. **If the two ever disagree,
> the PDF wins** — re-read it rather than trusting this file.

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

Each of these gets a rejecting test **and** an accepting test — see
[`07_TESTING_AND_REVIEW.md`](07_TESTING_AND_REVIEW.md).

### Mandatory deliverables (explicitly required)

- [ ] Contact, Product, Chart of Accounts, Journal, Journal Entry master data
- [ ] Purchase Order → Vendor Bill → Payment
- [ ] Sales Order → Customer Invoice → Payment (with tax)
- [ ] Analytic Account + Budget
- [ ] Balance Sheet
- [ ] Profit & Loss
- [ ] Budget Report
- [ ] Contact portal — view own documents, make payment
- [ ] Three roles enforced server-side

### Bonus / optional (not asked for — build only after the above is green)

- [ ] Partial payments allocated across several documents
- [ ] Drill-down: report figure → account → journal lines → source document
- [ ] Aged receivables / payables
- [ ] Period lock (a closed month cannot be posted into)

### 🟩 The one "wow" moment we'll demo first

**A live, drill-down Balance Sheet with a permanent `Trial balance 0.00 ✓` badge.**

Click any figure → the accounts behind it → the journal lines → the invoice that created
them. The badge asserts `Σ debit − Σ credit = 0` across the whole ledger and is
recomputed on every posting, live over SSE.

Why this one: most teams will store balances on invoices and sum them into a balance
sheet. Drill-down is only *possible* if the ledger is real, so the feature is itself the
proof that the accounting is genuine.

### ⬛ Explicitly out of scope (goes in the README, honestly)

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

**Why we need them at all — the honest version.** This statement is drier than the two we
rejected. DealFlow360 had live upsell scoring and a negotiation portal; PeoplePay360 had a
payslip engine. Ours is master data, two document chains, and three reports. Done exactly to
spec, it is *correct* and *unmemorable*. The ledger engine is our substance; these are what
make that substance visible to someone watching for four minutes.

### 3.1 The intelligence layer

⚠️ **Deliberately not an LLM.** The organizers say *"plan for offline or local solutions;
don't rely entirely on internet connectivity"* — an API call makes venue wifi a demo
dependency, and a confidently wrong answer on stage is worse than no feature at all.
Everything below is deterministic, computed from our own ledger, and **cites the rows it
came from**.

That is also the better answer to *"did you use AI — do you understand this code?"*, which
the organizers explicitly warn about. We can explain every one of these in a sentence.

| # | Feature | What it does | Effort | Why it lands |
|---|---|---|---|---|
| 1 | **Duplicate bill detection** | Same vendor, amount within ±2%, within 7 days → warn before posting, with a link to the suspected original | Low | A real accounts-payable control. Duplicate-payment loss is a genuine business problem, and every accountant in the room has felt it. |
| 2 | **Smart account suggestion** | Suggests the expense/income account from our own posting history: *"5000 Purchase Expense — used for 12 of the last 14 bills from this vendor"* | Low | Learns from the ledger with a frequency count. No library, no model, fully explainable. |
| 3 | **Amount anomaly flag** | z-score against that contact's own history: *"₹4,80,000 is 3.2σ above this vendor's average of ₹42,000"* | Low | The one idea worth stealing from DealFlow360, and it fits accounting even better. |
| 4 | **Cash-flow forecast** | Projects the cash position 30/60/90 days out from open documents, due dates, and each customer's historical days-to-pay | Medium | Real treasury functionality, pure arithmetic, and a strong dashboard hero. |
| 5 | **Budget burn projection** | *"At the current rate this budget exceeds plan by ₹42,000 on 22 Sep"* | Low | Extends a **mandatory** deliverable rather than adding a new surface — best effort-to-impact ratio here. |

**The pitch line:** *"No black box. Every flag explains itself in one sentence and cites the
rows it came from."*

### 3.2 UI and interaction

| # | Feature | What it does | Effort | Why it lands |
|---|---|---|---|---|
| 6 | **Posting preview (T-account)** | Before you hit Post, see the exact journal entry that *will* be created, drawn as the classic two-column T | Low | **The strongest single item on this page.** It makes the invisible engine visible, proves the double-entry is real without a word of explanation, and is a natural demo beat. A `<div>` with a border. |
| 7 | **Keyboard-first entry** | ⌘K command palette, tab-through line entry, Enter for a new line, ⌘⏎ to post | Medium | Accountants live on keyboards. "We designed for the actual user" is a real answer to a judge's question. |
| 8 | **Dense data-grid aesthetic** | Right-aligned tabular numerals, debit and credit as two columns, hairline rules, no marketing cards | Low | Reads as professional finance software rather than a template. Mostly a styling decision made once. |

### 3.3 If only one thing gets built

**#6, the posting preview.** It is low effort, it directly demonstrates the thing that makes
this build different from every other team's invoice list, and it needs no explanation from
the presenter — the judge simply sees debits equal credits before the document is committed.

Second choice: **#5, budget burn projection**, because it deepens something already required
instead of widening the surface area.

### 3.4 The rule

Ranked by *impact ÷ effort*, built strictly after the mandatory list is green, and **each
one either works or comes out**. A dashboard tile that promises "Cash Forecast" and renders
nothing is worse than no tile — that exact mistake is [`10_LESSONS.md`](10_LESSONS.md) §14.
