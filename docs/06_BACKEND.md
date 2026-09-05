# 06 — BACKEND PLAYBOOK

> **Owner:** Backend Core. **Read before your first router.**
> **The single most important file you will write is `services/posting.py`.** Everything
> else in this system is CRUD around it.

---

## 1. BUILD ORDER — do not reorder

The ledger comes before the documents, because the documents exist to feed it. Building a
document chain first means writing it twice.

1. **Chart of Accounts + Journals** — nothing can post without these
2. **`journal_entries` + `journal_lines`** with their CHECK constraints
3. **`services/posting.py`** — the `post_entry()` primitive, plus its tests
4. **Contacts + Products** with their account mappings
5. **Sales chain** — SO → Invoice → post. *One full vertical slice before anything else.*
6. **Payments + allocations**
7. **Purchase chain** — mirrors the sales chain; mostly a copy
8. **Reports** — pure aggregation, fast once the ledger is right
9. **Analytic accounts + budgets**
10. **Portal endpoints**

> Ship the sales slice end-to-end before starting the purchase chain. Two half-built
> chains demo as nothing; one finished chain demos as a product.

---

## 2. THE POSTING ENGINE

Every document that posts calls exactly one primitive. Write this once, correctly, and the
rest of the system inherits it.

```python
def post_entry(
    db: Session,
    *,
    journal: Journal,
    entry_date: date,
    reference: str,
    source_type: str,
    source_id: UUID,
    lines: list[LineDraft],      # (account, debit, credit, label, analytic?, partner?)
    actor_id: UUID,
) -> JournalEntry:
    """Create and post one balanced journal entry. The only way lines are ever written."""

    # 1 — REJECT before touching anything
    total_debit  = sum(l.debit  for l in lines)
    total_credit = sum(l.credit for l in lines)
    if total_debit != total_credit:
        raise AppError("UNBALANCED_ENTRY",
                       f"Debit {total_debit} does not equal credit {total_credit}.")
    if any(l.account.is_archived for l in lines):
        raise AppError("ACCOUNT_ARCHIVED", "...")

    # 2 — GUARD against double posting, at the database
    existing = db.scalar(select(JournalEntry).where(
        JournalEntry.source_type == source_type,
        JournalEntry.source_id == source_id,
        JournalEntry.state != EntryState.REVERSED))
    if existing:
        raise AppError("ALREADY_POSTED", "...")

    # 3 — ALLOCATE the number under a row lock (never MAX()+1 — it races)
    entry_number = next_sequence(db, journal)      # SELECT ... FOR UPDATE inside

    # 4 — WRITE
    entry = JournalEntry(..., state=EntryState.POSTED, posted_by_id=actor_id)
    db.add(entry); db.flush()
    db.add_all([JournalLine(entry_id=entry.id, **l.as_dict()) for l in lines])

    # 5 — COMMIT, then publish. Never the other way round.
    db.commit()
    emit("document.posted", type=source_type, id=str(source_id))
    emit("ledger.changed", **trial_balance_summary(db))
    return entry
```

**Corrections never mutate.** Cancelling a posted document creates a *reversing* entry —
same lines, debit and credit swapped, `reversal_of_id` set, original marked `REVERSED`:

```python
def reverse_entry(db, entry, *, actor_id, reason):
    swapped = [LineDraft(account=l.account, debit=l.credit, credit=l.debit, ...)
               for l in entry.lines]
    ...
```

Two entries now exist, both immutable, and the trial balance still lands on zero. That is
what makes the audit trail real rather than claimed.

---

## 3. THE FOUR POSTINGS

**Canonical table: [`03_DATA_MODEL.md`](03_DATA_MODEL.md) §5.** It is not repeated here —
two copies of the same accounting rules is how they drift apart.

The one implementation note that belongs in this file: accounts come from the data, never
from a constant. Receivable/payable off the **contact**, income/expense off the **product**,
bank/cash off the **journal**. A missing mapping raises `MISSING_ACCOUNT_MAPPING` rather
than silently posting to a fallback account.

---

## 4. THE LOCKING DISCIPLINE (the one thing to get right)

For any endpoint that changes a status:

```
1. LOCK the row you will mutate        lock_row(db, CustomerInvoice, invoice_id)
2. RE-CHECK its state AFTER the lock   require_status(inv.status, InvoiceStatus.DRAFT)
3. Mutate
4. Commit
5. THEN publish the event              emit("document.posted", ...)
```

Step 2 is the one everyone skips. A check made *before* the lock is a check against a value
that may already be stale — two concurrent requests both pass it and both post. This was a
real, shipped bug in the previous project.

**Here it is worse than a duplicate row: it is a duplicate journal entry**, and the books
are then wrong in a way a balanced trial balance will not reveal. The
`UNIQUE(source_type, source_id)` constraint from `03_DATA_MODEL.md` §3 is the backstop, but
lock first anyway — a constraint violation is an ugly 500 unless you catch it.

`services/rules.py` provides `lock_row`, `require`, `require_status` and `emit`.

---

## 5. PAYMENTS AND IDEMPOTENCY

A double-clicked "Register Payment" produces two payments, two balanced entries, and books
that are quietly wrong. The guard is a unique `idempotency_key`:

```python
key = request.headers.get("Idempotency-Key")
existing = db.scalar(select(Payment).where(Payment.idempotency_key == key))
if existing:
    return existing          # 200 with the original — a retry is not an error
```

Then, inside one transaction: validate `Σ allocations == payment.amount`, lock each target
document, check each allocation against its **remaining** balance
(`total - amount_paid`), raise `OVERALLOCATED_PAYMENT` if it exceeds, update `amount_paid`,
move status to `PARTIAL` or `PAID`, and post the entry.

---

## 6. REPORTS — aggregate the ledger, never sum the documents

```python
def balance_sheet(db, as_of: date):
    rows = db.execute(
        select(Account.type, Account.code, Account.name,
               func.sum(JournalLine.debit).label("d"),
               func.sum(JournalLine.credit).label("c"))
        .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
        .join(Account, JournalLine.account_id == Account.id)
        .where(JournalEntry.state == EntryState.POSTED,
               JournalEntry.entry_date <= as_of)
        .group_by(Account.type, Account.code, Account.name)
    ).all()
    # ASSET/EXPENSE are debit-positive; LIABILITY/EQUITY/INCOME are credit-positive
```

**Never** `SELECT SUM(total) FROM customer_invoices`. It is faster to write, looks correct
in the demo, and is silently wrong the moment anything is cancelled or credited. If a
reviewer sees a report reading a document table, that is a blocking review comment.

---

## 7. ERROR DISCIPLINE

- Raise `AppError(code, message, fields=...)` — never a bare `HTTPException` for domain
  failures, and never let a 500 reach the client for bad input.
- **Every code goes in the registry in [`04_API_CONTRACT.md`](04_API_CONTRACT.md) §4.**
- `fields` keys match request body field names exactly.

---

## 8. RBAC

Name dependencies by intent, at the top of the router:

```python
require_master_write  = require_roles("Admin", "Accountant")   # create
require_master_modify = require_roles("Admin")                 # modify + archive
require_txn_write     = require_roles("Admin", "Accountant")
```

The Admin/Accountant split is a graded rule, not decoration — an Accountant `PATCH` on
master data must return 403. The portal is data-scoped in the query
(`where contact_id == current_user.contact_id`), which is a filter, not a role.

---

## 9. LISTS

```python
return paginate(db, select(CustomerInvoice), params,
                sortable={"invoice_date": CustomerInvoice.invoice_date,
                          "number": CustomerInvoice.number,
                          "total": CustomerInvoice.total},
                searchable=[CustomerInvoice.number],
                default_sort="-invoice_date")
```

`sortable`/`searchable` are allowlists, so an arbitrary `?sort=` can't reach SQL.

---

## 10. MAKING DATA MOVE

Wire `services/simulator.py::_tick()` to post a small, believable transaction on a timer —
a customer payment landing against an open invoice is the best one, because it visibly
moves three things at once: the invoice status, the cash KPI, and the trial balance badge.

**It must call the same service functions the API calls.** Never write to the DB directly
there, or your "live" data will violate the very rules you are demonstrating.

Keep each tick small: a judge should see *one* thing change, not ten.

---

## 11. QUICK CHECKS

```bash
uv run pytest                                   # full suite
uv run uvicorn app.main:app --reload            # http://localhost:8000/docs
curl localhost:8000/api/v1/reports/trial-balance   # difference must be 0.00
../scripts/verify-sse.sh                        # prove real-time works
```

Swagger at `/docs` is genuinely demo-able — use `POST /auth/token` and the Authorize
button to show `UNBALANCED_ENTRY` or `OVERALLOCATED_PAYMENT` rejecting a bad request live.
