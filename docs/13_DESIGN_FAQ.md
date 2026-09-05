# 13 — DESIGN FAQ

> **What this is:** four worked walkthroughs with real numbers, followed by the reasoning
> behind every significant decision, as questions someone would actually ask.
>
> **Read the walkthroughs first.** They carry more understanding than the Q&A below, because
> they show the system doing something rather than describing it in the abstract. The Q&A
> exists to go deeper on a specific point once the flow is clear.
>
> **Status marker:** the platform (auth, RBAC, errors, pagination, events, audit) is built
> and tested. The accounting domain is specified and being built. If an answer here disagrees
> with the code, **the code is right and this file is stale** — fix it.

---

## PART 0 · WALKTHROUGHS

### Walkthrough A — a sale, start to finish

Nimesh Pathak orders 3 office chairs and 1 wooden table. Follow the money through every
table it touches.

**1. Sales Order.** The Accountant picks Nimesh, adds two lines:

| Product | Qty | Unit price | Line total |
|---|---|---|---|
| Office Chair | 3 | 2,000.00 | 6,000.00 |
| Wooden Table | 1 | 4,000.00 | 4,000.00 |

`sales_orders` gets a row, `status = DRAFT`, `total = 10,000.00`. Nothing has posted — a
Sales Order never touches the ledger.

**2. Confirm.** `POST /sales-orders/{id}/confirm` → `status = CONFIRMED`. Still no ledger
entry; confirming an order is a commitment, not a financial event.

**3. Create Invoice.** `POST /sales-orders/{id}/create-invoice` copies both lines into a new
`customer_invoices` row: `number = INV/2026/0042`, `reference` left for the user to fill in,
`status = DRAFT`. Tax at 18% is computed server-side: `untaxed_total = 10,000.00`,
`tax_total = 1,800.00`, `total = 11,800.00`.

**4. The posting preview** (before Confirm is clicked) shows the T-account the system is
about to write:

```
Debit                          Credit
1100 Debtors      11,800.00    4000 Sales Income     10,000.00
                                2100 Tax Payable       1,800.00
──────────────────────────    ──────────────────────────────
Total             11,800.00    Total                 11,800.00
```

**5. Confirm the invoice.** `POST /customer-invoices/{id}/post` runs the sequence from
[`06_BACKEND.md`](06_BACKEND.md) §4: lock the invoice row, re-check it is still `DRAFT`,
build the three lines above from `contact.receivable_account` and `product.income_account`,
assert the balance, allocate the entry number under its own lock, insert, **commit**, then
publish `document.posted` and `ledger.changed`. The invoice becomes `POSTED`. A new
`journal_entries` row exists with three `journal_lines` — permanently, and never edited
again.

**6. First payment — partial.** Nimesh pays 8,000.00 by bank transfer.
`POST /payments` with `invoice_id`, `amount: 8000.00`, `direction: RECEIVE`,
`journal: Bank`. The service checks `8,000.00 ≤ 11,800.00 − 0.00` — fine — locks the
invoice, posts:

```
Dr  1010 Bank        8,000.00
    Cr  1100 Debtors            8,000.00
```

`invoice.amount_paid = 8,000.00`, `status → PARTIAL`.

**7. Second payment — settles it.** Nimesh pays the remaining 3,800.00.
`amount: 3800.00`, checked against the **remaining** balance
(`11,800.00 − 8,000.00 = 3,800.00`) — exact match, allowed. Same posting shape, and
`status → PAID`.

**8. What the reports now show.** Two payment entries plus the invoice entry are all in
`journal_lines`. The Balance Sheet's Debtors figure is `11,800.00 − 8,000.00 − 3,800.00 =
0.00` for this invoice — computed by summing lines, not by reading `amount_paid`. The
Profit & Loss shows `10,000.00` of Sales Income for the period, unaffected by how or when the
cash arrived. The trial-balance badge stayed at `0.00` after every single step, because each
step posted a balanced entry.

**9. If Nimesh had been over-refunded or the invoice cancelled instead** — see Walkthrough D
for what happens to an entry that already posted.

### Walkthrough B — a purchase, start to finish

Mirrors Walkthrough A with the accounts flipped, and one structural difference worth calling
out: a bill does **not** have to come from a Purchase Order.

**1. Purchase Order** (optional). Raised against Azure Furniture for the same two products at
cost price. `status = DRAFT → CONFIRMED`.

**2. Vendor Bill.** Either `POST /purchase-orders/{id}/create-bill` (copies the PO's lines and
sets `po_id`), or a bill raised directly with `po_id = null` — the mockup shows the PO
back-link on the bill screen **only when one exists**; a fresh bill hides it entirely rather
than showing an empty field.

**3. Post.** `POST /vendor-bills/{id}/post`:

```
Dr  5000 Purchase Expense    10,000.00
    Cr  2000 Creditors                   10,000.00
```

One line per product category if they map to different expense accounts; one Creditors
credit for the total either way.

**4. Payment — sent, not received.** `direction: SEND`, journal `Bank`:

```
Dr  2000 Creditors     10,000.00
    Cr  1010 Bank                   10,000.00
```

**The only two things that differ from a sale:** which side of Debtors/Creditors moves, and
that a purchase document is allowed to exist with no order behind it at all.

### Walkthrough C — a budget's life

**1. Draft.** *"Furniture Expense"*, period 1–31 January, one line: analytic `Furniture`,
type `EXPENSE`, `committed_amount = 2,00,000.00`. Achieved is not stored — nothing has
happened yet, so it computes to `0.00`.

**2. Confirm.** `status → CONFIRMED`. The budget is now live: any vendor-bill line tagged
`Furniture` and dated in January will count toward it.

**3. A bill posts against it.** Walkthrough B's purchase used the `Furniture` analytic tag
on its line. The moment that bill posts, this budget's `achieved` recomputes on the *next
read* — nothing was written to the budget row. `achieved = 10,000.00`,
`achieved_pct = 5%`, `to_achieve = 1,90,000.00`.

**4. Clicking the achieved figure** opens a filtered list of vendor bills — every one carrying
the `Furniture` tag inside January — which is exactly the query that produced the number.

**5. The limit turns out to be too low.** Someone requests ₹3,50,000 instead of ₹2,00,000.
`POST /budgets/{id}/revise`:

```
"January 2026"            state → REVISED    (untouched: still shows achieved = 10,000)
"January 2026 Revised"    state = CONFIRMED  committed_amount = 3,50,000.00
                           revision_of → "January 2026"
```

Both budgets remain queryable forever. Nobody edited the ₹2,00,000 figure — a new fact was
recorded alongside the old one, the same instinct as reversing a journal entry instead of
deleting it.

### Walkthrough D — two requests race, and one document gets cancelled

**The race.** Two browser tabs both have Walkthrough A's invoice open in `DRAFT`, and both
click Confirm within the same millisecond.

```
Request 1                          Request 2
─────────                          ─────────
lock_row(invoice)  ✅ acquired
                                    lock_row(invoice)  ⏳ blocks — waits for the lock
require_status(DRAFT) ✅
build lines, post_entry()
  commit
  emit document.posted
                                    lock reacquired, sees status = POSTED now
                                    require_status(DRAFT) ❌ → ALREADY_POSTED
```

Request 2 never reaches `post_entry()` at all — it fails at the status re-check, which runs
*after* the lock, on a value read *after* the lock. If Request 2 had checked status *before*
requesting the lock (the bug this project's previous submission shipped), both requests would
have seen `DRAFT` and both would have posted — two balanced entries, the trial balance still
reading `0.00`, the books silently doubled. The `UNIQUE(source_type, source_id)` constraint
in `journal_entries` is what would catch it even if the lock discipline were somehow bypassed
— Request 2's insert would violate the constraint and raise, rather than succeed silently.

**Now cancel the posted invoice.** `POST /customer-invoices/{id}/cancel` does not touch the
original entry. It writes a second one:

```
original (still POSTED, still there):     Dr Debtors 11,800  Cr Sales 10,000  Cr Tax 1,800
reversal (new entry, reversal_of = orig): Dr Sales 10,000  Dr Tax 1,800  Cr Debtors 11,800
```

Both entries exist permanently. Net effect on every account: zero. The trial balance never
moved. The P&L for the period shows `10,000.00` of income and then `−10,000.00` from the
reversal — net `0.00`, and both numbers are visible to anyone who looks, rather than the
first one vanishing as if it never happened.

---

## PART 1 · WHY THIS SYSTEM IS BUILT THIS WAY

### 1 · The problem

**Q1. What does this system do, and why this problem statement?**
A double-entry accounting system for a furniture business — master data, purchase and sales
cycles through to payment, and reporting, where every report is computed from a ledger
rather than from the documents. It was chosen over two alternatives because its hard part is
a *correctness invariant* (debits always equal credits) rather than feature breadth, which is
more defensible in the time available, and because it has the smallest domain model of the
three offered.

**Q2. Who are the users, and what can each one do?**
Three roles. **Admin** has full rights, including modifying and archiving master data.
**Accountant** creates master data and records transactions but cannot modify or archive it —
the split comes straight from the statement's wording. **User** is a customer with portal
access to their own invoices and bills only, and can pay them from there.

**Q3. What's out of scope, and what would a real deployment still need?**
Multi-currency, bank reconciliation, recurring/deferred entries, fiscal-year closing, and
asset depreciation — all real, none asked for, each worth days we didn't have. Named in the
README rather than hidden. A real deployment would also want a proper audit-grade period
close, tax-filing formats, and concurrency testing at volume — the last of which
Walkthrough D exercises at the scale we could actually test.

### 2 · Architecture

**Q4. Describe the architecture in sixty seconds.**
A Next.js client talks to a FastAPI service over REST, plus one Server-Sent Events stream
for live updates. Routers handle HTTP and authorisation only; every business rule lives in
`services/`; one service module is the only thing that ever writes to the ledger tables.
Reports are aggregation queries over those tables. PostgreSQL underneath.

**Q5. Why a separate services layer, and why FastAPI / Next.js?**
The same rules must apply whether a change arrives from an API request or from the
background task that makes data move during the demo (Walkthrough A's posting sequence is
exactly what both call). If rules lived in routers, the background task would either
duplicate them or bypass them. FastAPI gives automatic OpenAPI docs at `/docs` that are
actually demonstrable, Pydantic validation at the edge, and native async for SSE. Next.js's
file-based routing removes a category of configuration the team doesn't need to reinvent.
Both were shipped with before, which matters more than a benchmark in a short build.

**Q6. Do you cache anything — and what would you cache at 100× the data?**
No, deliberately: every report is computed on read by aggregating journal lines, because
cache invalidation is the classic source of "the dashboard disagrees with the ledger" bugs,
and a stale financial report is worse than a slow one. At our volume the aggregates are
indexed and fast. At real scale the right lever is not caching the reports but snapshotting
**closed periods** — once a month is closed its balances can never change, so only the open
period needs aggregating fresh. That preserves the invariant instead of trading it for speed.

**Q7. Why SSE rather than WebSockets, and is there a queue?**
The traffic is one-directional — server tells browser something changed — so SSE (plain
HTTP, auto-reconnect, no extra infrastructure) is enough; WebSockets would add a protocol to
solve a problem we don't have. Services publish `document.posted`, `payment.registered` and
`ledger.changed` **after** the commit (see Walkthrough A step 5) so the UI never shows a
transaction that then rolls back. No queue either — the one background job posts through the
same service functions the API uses, on a timer, which doesn't need a broker.

---

## PART 2 · THE ACCOUNTING CORE

**Q8. What is double-entry, and where is it actually enforced?**
Every transaction touches at least two accounts and total debits must equal total credits.
Three layers enforce it: CHECK constraints so one line can't be negative or two-sided
(`03_DATA_MODEL.md` §3), a balance assertion inside the posting transaction — which cannot
be a CHECK constraint, since a CHECK can't see sibling rows, so it runs as code but *inside
the same transaction as the insert*, meaning a failure rolls back the whole posting — and the
live trial-balance badge that recomputes after every step of Walkthrough A.

**Q9. What happens when you try to edit or delete a posted document?**
Nothing — the API returns `CANNOT_MODIFY_POSTED`. Corrections happen by cancelling, which
writes a *reversing* entry (Walkthrough D), never a delete or an update. Deleting would make
the books agree with themselves while destroying the history of what actually happened;
reversal keeps both facts on the record and the trial balance still lands on zero.

**Q10. How is the Balance Sheet computed, and why not just sum the invoices?**
By grouping `journal_lines` by account type and applying each type's normal balance —
assets/expenses debit-positive, liabilities/capital/income credit-positive — which is
provably correct because every entry that produced those lines already balanced individually.
Summing invoices instead is faster to write and looks right until the first cancellation:
Walkthrough D's reversed invoice would still show its income if the P&L read documents
instead of the ledger. The trial-balance figure itself (`Σ debit − Σ credit`) is a live query,
never hard-coded, and there's a test asserting it stays zero after arbitrary sequences of
postings and reversals.

**Q11. What are analytic accounts, and how does budget achievement actually get computed?**
An analytic account is a reporting tag — a project or department — kept separate from the
Chart of Accounts so tagging a line doesn't distort the ledger's structure. It sits on
**document** lines (invoice, bill, order), not journal lines, because that's what the mockup
specifies and describes the search in exactly those terms; tagging journal lines instead
would be defensible accounting and the wrong answer to what we were asked to build.
Walkthrough C shows the whole computation: only `committed_amount` is stored, and `achieved`,
`achieved_pct` and `to_achieve` are all derived on read by summing document lines carrying
that tag within the period — so they can never go stale, and a click on the figure opens
exactly the documents summed to produce it.

**Q12. Why does a confirmed budget get revised instead of edited?**
The same reasoning as reversing a journal entry: a confirmed budget's history is a fact, not
a draft. Revising creates a linked successor (Walkthrough C step 5) rather than overwriting
the number, so both the old commitment and the new one stay on record and either can be
opened from the other.

---

## PART 3 · DATA MODEL

**Q13. Why `Numeric(12,2)` instead of a float, and what's enforced at the database level?**
Binary floating point can't represent most decimal fractions exactly, so repeated addition
drifts — in an accounting system that eventually shows up as a total off by a paisa and a
trial balance that won't close. `Numeric` is exact decimal arithmetic. Beyond that, the
database enforces uniqueness on every document number, account code, contact email and the
payment idempotency key, plus CHECK constraints for every numeric rule and the one-sidedness
of a journal line. A rule enforced only in application code is one refactor away from not
being enforced; the database is the layer no route-handler bug can bypass.

**Q14. How are document numbers generated without a race, and why gapless?**
`MAX(number) + 1` races — two concurrent confirms can read the same max and both produce the
same next number. The number is allocated **inside the posting transaction** while holding a
row lock on a sequence row, so concurrent posts serialise (this is the same lock discipline
Walkthrough D traces for the invoice row itself). The result is gapless, which matters
because a gap in an accounting sequence is an audit finding in real systems.

**Q15. What did you index, and how do migrations work here?**
Every foreign key, every status column, and every date used in a report filter — because
that's exactly what the heaviest query (the report aggregation over `journal_lines` by
account and date) scans. Alembic autogenerates migrations, which get **read before applying**
rather than trusted, since autogenerate handles CHECK constraints and enums inconsistently;
every model has to be imported in `models/__init__.py` or autogenerate silently produces an
empty migration. Status columns use `native_enum=False` so adding a value later is a code
change, not a schema migration.

---

## PART 4 · CONCURRENCY AND SECURITY

**Q16. Walk through what actually stops a duplicate posting.**
See Walkthrough D in full — the short version is: lock the row, re-check status *after*
acquiring the lock (not before, which is the bug this exact class of problem produced in the
previous project), and back both with a `UNIQUE(source_type, source_id)` database constraint
so even a bypassed lock can't produce two live entries for the same document. It matters more
here than in most systems because the failure is **silent**: two balanced duplicate entries
leave the trial balance at zero and every report still renders — the books are simply doubled
with nothing on screen to indicate it.

**Q17. What about a double-clicked "Pay" button, and does the database choice matter?**
The payment carries a unique `idempotency_key`; a repeat request returns the original payment
rather than creating a second one, since a retry isn't an error. And yes — we tested this
rather than assumed it. `SELECT … FOR UPDATE` is **silently dropped** on SQLite (the lock
clause just disappears, no error), so `lock_row()` stops locking there while looking correct
in the source. PostgreSQL is required for anything graded; decimal precision, contrary to the
common claim, is exact on both.

**Q18. How does auth work, and why an httpOnly cookie?**
Email and bcrypt-hashed password, returning a JWT set as an httpOnly cookie (plus a bearer
token for Swagger/`curl`). JavaScript can't read an httpOnly cookie, so an XSS bug can't
exfiltrate the session — a token in `localStorage` is readable by any script that runs on the
page, injected or not. Authorisation is a role check on the route itself; the frontend hiding
a button is convenience, never the boundary.

**Q19. How do you stop one customer from seeing another's invoice?**
Portal queries are scoped to the caller's own contact **in the query**, not filtered
afterwards, and requesting someone else's document returns **404, not 403** — a 403 would
confirm the record exists, which leaks information across customers.

**Q20. What security gaps are you being honest about?**
No rate limiting — a real gap, not an oversight, and not worth configuring for a local
single-tenant demo that protects against nothing present. SQL injection is a non-issue
structurally: every query goes through SQLAlchemy with bound parameters, and the one place
user input could influence query *structure* — sorting — is allowlisted per endpoint rather
than passed through.

---

## PART 5 · API, TESTING, PERFORMANCE

**Q21. What's the error contract?**
Every non-2xx response is `{error: {code, message, fields}}` — `code` is a stable string the
frontend switches on (e.g. `OVERALLOCATED_PAYMENT` from Walkthrough A step 7 if the second
payment had been too large), `message` is safe to show a user, `fields` maps request field
names to messages so the UI drops them straight into the form. Invalid input never returns a
500, and every code is listed in the API contract's registry — an unlisted code is an
undocumented API.

**Q22. How does pagination work, and is the API versioned?**
`page`, `page_size`, `sort` and `q` on every list endpoint, returning
`{items, total, page, page_size, pages}` — counts in the UI read `total`, never
`items.length`, which is one page and was a real bug last round. The API sits under
`/api/v1`; it costs nothing now and avoids coordinating every client at once on a future
breaking change.

**Q23. What did you test, and what's the single most valuable test in the repo?**
The ledger invariants first — every posted entry balances, the trial balance is zero after
any sequence of operations, and a cancelled invoice leaves no income behind. That last one is
the most valuable test here: it passes only if reports read the ledger, and fails immediately
for an implementation that sums documents instead — exactly the shortcut Walkthrough D's
reversal makes visibly wrong. Then every business rule gets a rejecting and an accepting
case, then the error envelope, then the demo path.

**Q24. What didn't you test, and how do you test concurrency?**
Coverage for its own sake, the framework, and the platform's own auth — already covered
elsewhere. The SSE stream can't be driven in-process (`EventSourceResponse` uses anyio task
groups neither the test client nor the ASGI transport can drive), so its wire format is
verified against a real server by a script instead. Concurrency is tested by racing two posts
of the same document (Walkthrough D) and asserting exactly one entry exists — marked to run
on PostgreSQL only, since the test would pass vacuously on SQLite where the lock is a no-op.

**Q25. How does it behave with a lot of data?**
Every list is paginated server-side from the first screen, so nothing returns an unbounded
result set, and report aggregations are indexed on account and date. The known scaling limit
is the report scan over all history — the period-snapshot approach from Q6 is what addresses
it. N+1 queries are the most likely place for a regression as screens grow, so it's on the
review checklist rather than assumed absent.

---

## PART 6 · PROCESS AND REFLECTION

**Q26. Did you use AI, and why no features that call a model?**
Yes, as an assistant, and the bar is that every member can explain any line committed — pick
the posting function from Walkthrough A step 5 and walk through why each step exists. The
"intelligent" features (duplicate-bill detection, anomaly flags) are deliberately arithmetic
over our own ledger rather than a model call, for two reasons: the organisers ask for
solutions that work offline, and a confidently wrong statement about someone's accounts is
worse than no statement at all.

**Q27. How did the team split the work?**
By concern — frontend, backend, reports, QA — with branches named after the work rather than
the person. Everyone commits under their own account; feature branches merge into `dev`
through review, and `dev` merges to `main` when green.

**Q28. What was the hardest part, and what surprised you?**
Keeping the ledger's single write path genuinely single — it's easy to state and easy to
violate, since a seed script or background task writing rows directly looks perfectly
reasonable in review and silently breaks the guarantee everything else depends on. The
surprise was Q17's finding: we expected decimal precision to be where SQLite differed from
Postgres, tested it, and found the opposite — precision was fine, row locking was the real
gap.

**Q29. What would you do differently, and what would you build next?**
Read the mockup before the written statement — it's considerably more specific, and several
things designed from the PDF alone (account types, the analytic model, the whole budget
workflow) had to be corrected against it. With more time: bank reconciliation, multi-currency
with FX gain/loss, and a proper period close with lock dates — the three that would turn this
from a correct ledger into something a business could run its month on.

**Q30. What are you most proud of?**
That you can click any figure on the Balance Sheet and follow it down to the invoice that
created it — Walkthrough A's `11,800.00` all the way back to two chairs and a table. That
path only exists if the accounting underneath is real, which makes it both the nicest feature
and the proof that everything above it in this document is true rather than asserted.
