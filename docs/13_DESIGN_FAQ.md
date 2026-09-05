# 13 — DESIGN FAQ

> **What this is:** the reasoning behind every significant decision in this project, as
> short answers to the questions someone would actually ask.
>
> **Read it to refresh your own understanding**, not to memorise lines. If an answer here
> doesn't match what the code does, **the code is right and this file is stale** — fix it.
>
> **Status marker:** the platform (auth, RBAC, errors, pagination, events, audit) is built
> and tested. The accounting domain is specified and being built. Answers describing the
> domain describe the design; say so plainly if asked whether a given piece is finished.

---

## 1 · THE PROBLEM

**Q1. What does this system do, in one sentence?**
It is a double-entry accounting system for a furniture business: master data, purchase and
sales cycles through to payment, and financial reporting — Balance Sheet, Profit & Loss and
Budget — where every report is computed from a ledger rather than from the documents.

**Q2. Why this problem statement?**
It is the one whose hard part is a *correctness invariant* rather than feature breadth.
Double-entry gives us something provable — debits always equal credits — which is more
defensible than a wide but shallow CRUD surface. It also has the smallest domain model of
the three offered, so the time goes into getting it right rather than getting it typed.

**Q3. Who are the users?**
Three roles. **Admin** has full rights including modifying and archiving master data.
**Accountant** creates master data and records transactions but cannot modify or archive.
**User** is a customer with portal access to their own invoices and bills only, and can pay
them. The Admin/Accountant split comes straight from the statement's own wording.

**Q4. What is deliberately out of scope?**
Multi-currency and FX, bank reconciliation, recurring and deferred entries, fiscal-year
closing entries, and asset depreciation. All are real accounting features; none are asked
for, and each would have cost days. They are listed in the README rather than hidden.

**Q5. What would a real business still need before using this?**
Bank reconciliation, an audit-grade period close, tax filing formats, and multi-user
concurrency testing at volume. We would also want the analytic dimension to support
hierarchies, which we flattened deliberately.

---

## 2 · ARCHITECTURE

**Q6. Describe the architecture in sixty seconds.**
A Next.js client talks to a FastAPI service over REST, plus one Server-Sent Events stream
for live updates. Routers handle HTTP and authorisation only; all business rules live in
services; a single service module is the only thing that writes to the ledger tables.
Reports are aggregation queries over those tables. PostgreSQL underneath.

**Q7. Why is there a separate services layer at all?**
Because the same rules must apply whether a change arrives from an API request or from the
background task that makes data move during the demo. If rules lived in routers, the
background task would either duplicate them or bypass them — and bypassing them would
produce an unbalanced ledger.

**Q8. Why FastAPI?**
Automatic OpenAPI docs at `/docs` that are genuinely demonstrable, Pydantic validation at
the edge so bad input never reaches business logic, and native async for the SSE stream.
The team has shipped with it before, which matters more than any benchmark in a 24-hour
build.

**Q9. Why Next.js and the App Router?**
File-based routing removes a whole category of configuration, and the team knows it. We
render on the client and talk to the API directly — server components would add a second
place where data fetching lives for no benefit at this size.

**Q10. Do you use caching?**
**No, deliberately.** Every report is computed on read by aggregating journal lines. Cache
invalidation is the classic source of "the dashboard says something different from the
ledger" bugs, and a stale financial report is worse than a slow one. At our data volume the
aggregate queries are indexed and fast; the correctness guarantee is worth more than the
milliseconds.

**Q11. What would you cache if the data were 100× bigger?**
Not the reports themselves — the *closed periods*. Once a month is closed, its balances can
never change, so we would snapshot period-end balances and aggregate only the open period on
top. That keeps the invariant intact instead of trading it away.

**Q12. Why Server-Sent Events instead of WebSockets?**
The traffic is one-directional — the server tells the browser something changed. SSE is
plain HTTP, reconnects automatically, needs no extra infrastructure, and works offline on a
laptop. WebSockets would add a protocol and a dependency to solve a problem we don't have.

**Q13. How does the frontend stay in sync?**
The client subscribes once to `/events`. Services publish `document.posted`,
`payment.registered` and `ledger.changed` **after** the database transaction commits, and
the affected screens refetch. Publishing before the commit would let the UI show a
transaction that then rolled back.

**Q14. Is there a message queue or background worker?**
No. There is one asyncio task in the app's lifespan that posts a small transaction on a
timer, and it calls the same service functions the API does. A queue would be
infrastructure we would have to defend without a workload that needs it.

---

## 3 · THE ACCOUNTING CORE

**Q15. What is double-entry, and how do you enforce it?**
Every transaction touches at least two accounts, and total debits must equal total credits.
We enforce it in three places: CHECK constraints so a single line cannot be negative or
two-sided, a balance assertion inside the posting transaction, and a live trial-balance
figure in the UI that recomputes on every posting.

**Q16. Why is the balance rule not a database constraint?**
A CHECK constraint cannot see sibling rows, so it cannot sum an entry's lines. The
assertion therefore lives in the posting service — but *inside the same transaction as the
insert*, so a failure rolls the whole thing back. It is never possible to commit an
unbalanced entry.

**Q17. What happens if someone edits a posted invoice?**
They cannot. A posted document is immutable, and the API returns `CANNOT_MODIFY_POSTED`.
Corrections happen by cancelling, which writes a **reversing entry** — the same lines with
debit and credit swapped — leaving both entries in the ledger permanently.

**Q18. Why reverse instead of just deleting the entry?**
Because an accounting system's value is that history cannot be rewritten. Deleting would
make the books agree with themselves while destroying the audit trail. Reversal keeps both
facts — what was recorded, and what corrected it — and the trial balance still lands on
zero.

**Q19. How is the Balance Sheet computed?**
By grouping journal lines by account type and applying each type's normal balance: assets
and expenses are debit-positive, liabilities, capital and income are credit-positive. It
reads the ledger only. Assets always equal liabilities plus capital, because every entry
that produced them balanced.

**Q20. Why not just sum the invoices? It would be simpler.**
It would, and it would be wrong. Summing documents ignores cancellations, reversals and
partial payments, and it produces a report that looks right until the first credit note.
The ledger is the single source of truth; documents are inputs to it, not a parallel record
of it.

**Q21. How do you know the trial balance is actually zero, rather than displayed as zero?**
It is a computed query — `Σ debit − Σ credit` across every posted line — surfaced in the app
shell and recomputed over SSE after each posting. There is a test asserting it after
arbitrary sequences of operations, including cancellations. It is never hard-coded.

**Q22. What are the four postings?**
Customer invoice: debit Debtors, credit Sales Income and Tax Payable. Vendor bill: debit
Purchase Expense, credit Creditors. Payment received: debit Bank/Cash, credit Debtors.
Payment sent: debit Creditors, credit Bank/Cash. Accounts come from the contact, the
product and the journal — never from constants in code.

**Q23. What are analytic accounts for?**
They are a reporting dimension separate from the Chart of Accounts — a way to tag a line
with a project or department without distorting the ledger structure. Budgets measure
achievement against these tags, so you can budget "Furniture" without creating an account
for it.

**Q24. How is budget achievement calculated?**
For each budget line, we sum the document lines carrying that analytic account within the
budget period — invoices for income types, bills for expense types. Achieved percentage and
amount remaining derive from that. Only the committed amount is stored; the other three
figures are computed on read so they cannot go stale.

**Q25. Why does budget achievement read documents rather than the ledger?**
Because the specification defines it that way — the analytic tag sits on invoice and bill
lines and the search is described in those terms. Tagging journal lines would be defensible
accounting and the wrong answer to the requirement we were given. It is a deliberate,
documented exception.

**Q26. What happens when a confirmed budget needs to change?**
It is revised, not edited. Revising creates a new budget carrying the original name plus
"Revised", moves the original to a `REVISED` state, and links the two in both directions.
The same immutability instinct as the ledger, applied to planning.

---

## 4 · DATA MODEL

**Q27. Why `Numeric(12,2)` and not a float?**
Binary floating point cannot represent most decimal fractions exactly, so repeated addition
drifts. In an accounting system that drift eventually shows on screen as a total that is off
by a paisa — and a trial balance that will not close. `Numeric` is exact decimal arithmetic.

**Q28. What is enforced at the database level rather than in code?**
Uniqueness on every document number, account code, contact email and the payment idempotency
key. CHECK constraints for quantity, price and amount ranges, and for the one-sidedness of a
journal line. A unique constraint on the posting source, which is what makes double-posting
impossible rather than merely unlikely.

**Q29. Why put rules in the database when the service already checks them?**
Because a rule enforced only in application code is one refactor away from not being
enforced. The database is the last line that no bug in a route handler can bypass — and it
demonstrates real data modelling, which the statement lists as something it wants to see.

**Q30. How are document numbers generated? Isn't that a race?**
It would be with `MAX(number) + 1`. We allocate the number inside the posting transaction
while holding a row lock on a sequence row, so two concurrent posts serialise. The result is
gapless, which matters because a gap in an accounting sequence is an audit finding.

**Q31. What did you index, and why those columns?**
Every foreign key, every status column and every date used in a report filter — because
those are exactly what the list screens sort and filter on and what the reports scan. The
heaviest query in the system is the report aggregation over journal lines by account and
date, so those two carry indexes.

**Q32. How do you handle migrations?**
Alembic, autogenerated then read before applying — autogenerate handles CHECK constraints
and enums inconsistently, so the generated file gets reviewed rather than trusted. Every
model is imported in `models/__init__.py`, without which autogenerate produces an empty
migration.

**Q33. Why `native_enum=False` on status columns?**
A native PostgreSQL enum type requires a migration dance to add a value. Storing the enum as
a constrained string means adding a status later is a code change, not a schema migration —
which is the right trade in a build where the status set may still move.

---

## 5 · CONCURRENCY AND CORRECTNESS

**Q34. Two users confirm the same invoice at the same moment. What happens?**
One wins. The posting service takes a row lock on the invoice, re-checks its status *after*
acquiring the lock, and the loser gets `ALREADY_POSTED`. Behind that, a unique constraint on
the posting source makes a duplicate entry impossible even if the lock were somehow missed.

**Q35. Why re-check the status after the lock rather than before?**
A check made before the lock is a check against a value that may already be stale — both
requests read `DRAFT`, both proceed, both post. This is not hypothetical: the same bug
shipped in our previous project, where a guard was evaluated before the row was locked.

**Q36. Why does a duplicate entry matter more here than elsewhere?**
Because it fails silently. Two identical balanced entries leave the trial balance at zero and
every report still renders — the books are simply doubled, with nothing on screen to
indicate it. That is why it gets both a lock and a constraint.

**Q37. What if a user double-clicks "Pay"?**
The payment carries an idempotency key with a unique constraint. A repeat request returns the
original payment rather than creating a second one — a retry is not an error. Without it you
get two payments, two balanced entries, and quietly wrong books.

**Q38. Where do transactions begin and end?**
One per request, opened by the session dependency. A posting does its validation, locking,
numbering and inserts inside that single transaction and commits once. Events are published
only after the commit returns.

**Q39. Does the database choice affect any of this?**
Yes, and we tested it rather than assumed. `SELECT … FOR UPDATE` is silently dropped on
SQLite — the lock clause simply disappears with no error — so anything being graded runs on
PostgreSQL. Decimal precision, contrary to the common claim, is exact on both.

---

## 6 · SECURITY

**Q40. How does authentication work?**
Email and password, verified with bcrypt, returning a JWT set as an httpOnly cookie. A
bearer token is also accepted so Swagger and `curl` demos work. Every endpoint except health
and login requires authentication.

**Q41. Why an httpOnly cookie rather than localStorage?**
JavaScript cannot read an httpOnly cookie, so a cross-site scripting bug cannot exfiltrate
the session token. A token in `localStorage` is readable by any script that runs on the
page, including an injected one.

**Q42. How is authorisation enforced?**
By a dependency on each route that checks the caller's role — the server is the boundary.
The frontend also hides actions a role cannot perform, but that is convenience only; hiding
a button is not a permission, and the API rejects the request regardless.

**Q43. How do you stop one customer seeing another's invoice?**
Portal queries are scoped to the calling user's own contact in the query itself, not
filtered afterwards. Requesting someone else's document returns **404, not 403** —
a 403 would confirm the record exists, which leaks information across customers.

**Q44. How are passwords stored?**
bcrypt hashes, never the password. We call bcrypt directly rather than through `passlib`,
which was last released in 2020 and breaks against modern bcrypt versions — a real
incompatibility we hit and avoided.

**Q45. What stops SQL injection?**
All queries go through SQLAlchemy with bound parameters; no string interpolation reaches
SQL. The one place user input could influence query *structure* is sorting, which is why
sort and search fields are allowlisted per endpoint rather than passed through.

**Q46. Is there rate limiting?**
No, and that is an honest gap rather than an oversight — it is on the list of what a real
deployment needs. For a local, single-tenant demo it would add configuration without
protecting against anything present.

---

## 7 · API DESIGN

**Q47. What is your error contract?**
Every non-2xx response is `{error: {code, message, fields}}`. The code is a stable
SCREAMING_SNAKE string the frontend switches on, the message is safe to show a user, and
`fields` maps request field names to messages so the UI can drop them straight into the
form. Invalid input never returns a 500.

**Q48. Give an example of a domain error code.**
`UNBALANCED_ENTRY` when debits and credits disagree, `OVERALLOCATED_PAYMENT` when a payment
exceeds a document's remaining balance, `ACCOUNT_ARCHIVED` when posting to a retired
account. Every code is listed in the API contract document — an unlisted code is an
undocumented API.

**Q49. How does pagination work?**
`page`, `page_size`, `sort` and `q` on every list endpoint, returning
`{items, total, page, page_size, pages}`. Counts in the UI read `total`, never
`items.length` — the latter is one page and was a real bug in our previous submission.

**Q50. Is the API versioned?**
Yes, under `/api/v1`. It costs nothing now and means a breaking change later does not
require coordinating every client at once.

---

## 8 · TESTING

**Q51. What did you test, and why that?**
The ledger invariants first — that every posted entry balances, that the trial balance is
zero after any sequence of operations, and that a cancelled invoice leaves no income behind.
Then every business rule with both a rejecting and an accepting case, then the error
envelope, then the demo path.

**Q52. What is the single most valuable test in the repository?**
The one asserting that a cancelled invoice leaves zero income in the P&L. It passes only if
reports read the ledger; an implementation that sums documents fails it immediately. It
guards the design decision the whole project rests on.

**Q53. What did you deliberately not test?**
Coverage for its own sake, the framework, and the platform's own auth — already covered by
the existing suite. We also cannot test the SSE stream in-process: the response uses anyio
task groups that neither the test client nor the ASGI transport can drive, so the wire
format is verified by a script against a real server instead.

**Q54. How do you test concurrency?**
With a test that races two posts of the same document and asserts exactly one entry exists.
It is marked to run against PostgreSQL only, because row locks are a no-op on SQLite and the
test would otherwise pass without proving anything.

---

## 9 · PERFORMANCE

**Q55. How does it behave with a lot of data?**
Lists are paginated server-side from the first screen, so no endpoint returns an unbounded
result set. Report aggregations are indexed on account and date. The known scaling limit is
the report scan over all history, which is what the period-snapshot approach in Q11 would
address.

**Q56. Are there N+1 query problems?**
The list endpoints load relationships eagerly where they are displayed. It is the most
likely place for one to appear as screens grow, so it is on the review checklist rather than
assumed absent.

---

## 10 · PROCESS AND AI

**Q57. Did you use AI to build this?**
Yes, as an assistant — and every member can explain any line they committed. We treat that
as the actual bar, and it is why the "intelligent" features are deterministic and cite the
rows they came from rather than calling out to a model.

**Q58. Explain a piece of this code you did not write by hand.**
Pick the posting function and walk it: validate the balance, guard against a duplicate
source, allocate the number under a lock, insert, commit, then publish. Every step exists
because of a specific failure it prevents — say which failure.

**Q59. Why are there no AI features that call a model?**
Two reasons. The organisers asked for solutions that work offline, and a model call makes
network availability part of the demo. And a confidently wrong answer about someone's
accounts is worse than no answer — the anomaly and duplicate checks are arithmetic we can
explain and defend.

**Q60. How did the team split the work?**
By concern — frontend, backend, reports and pitch, QA — with branches named after the work
rather than the person. Everyone commits under their own account, feature branches merge
into `dev` through review, and `dev` merges to `main` when green.

---

## 11 · REFLECTION

**Q61. What was the hardest part?**
Keeping the ledger's single write path genuinely single. It is easy to state and easy to
violate — a seed script or a background task writing rows directly looks perfectly
reasonable in review, and it silently breaks the guarantee everything else depends on.

**Q62. What surprised you?**
That `SELECT … FOR UPDATE` compiles away to nothing on SQLite with no error. We had assumed
the database difference that mattered was decimal precision; we tested both and found the
opposite of what we expected.

**Q63. What would you do with another week?**
Bank reconciliation, multi-currency with FX gain and loss, and a proper period close with
lock dates. Those three turn this from a correct ledger into something a business could
actually run its month on.

**Q64. What would you do differently?**
Read the mockup before the written statement. The Excalidraw flow is considerably more
specific than the PDF, and several things we designed from the PDF alone had to be
corrected against it.

**Q65. What are you most proud of?**
That you can click any figure on the Balance Sheet and follow it down to the invoice that
created it. That path only exists if the accounting underneath is real — which makes it both
the nicest feature and the proof that the rest is honest.
