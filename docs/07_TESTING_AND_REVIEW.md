# 07 — TESTING & CODE REVIEW

> **Owner:** QA / Review. **Everyone reads §3 before opening a merge.**

---

## 1. WHAT TO TEST (and what to skip)

You will not have time to test everything, and you shouldn't try. Test in this order
and stop when you run out of time:

1. **The ledger invariants** — see §1.1. These are the system.
2. **Business rules** — every "must"/"cannot" from
   [`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md) §2 gets a **reject** case *and* an
   **accept** case. This is what judges probe.
3. **The error envelope** — bad input returns an enveloped 4xx, never a 500.
4. **The demo path** — the exact sequence you'll walk through, end to end.
5. **Money maths** — rounding and allocation errors are humiliating on screen.

**Do not** chase coverage numbers, test the framework, or re-test the boilerplate's
auth (already covered by 32 passing tests).

### 1.1 The ledger invariant suite — write these first

One property test is worth ten example tests here. After **any** sequence of operations,
these must hold:

```python
def test_trial_balance_is_always_zero(db, seeded_month):
    """The single most important test in this repository."""
    total_debit, total_credit = trial_balance(db)
    assert total_debit == total_credit

def test_every_posted_entry_balances(db, seeded_month):
    for entry in db.scalars(select(JournalEntry).where(
            JournalEntry.state == EntryState.POSTED)):
        assert sum(l.debit for l in entry.lines) == sum(l.credit for l in entry.lines)

def test_balance_sheet_equation_holds(db, seeded_month):
    bs = balance_sheet(db, as_of=date.today())
    assert bs.assets == bs.liabilities + bs.equity

def test_reports_never_read_document_tables(db):
    """Guards the rule that makes this an accounting system, not an invoice list."""
    invoice = post_invoice(db, ...)
    cancel_invoice(db, invoice.id)          # writes a reversing entry
    pnl = profit_and_loss(db, ...)
    assert pnl.income == Decimal("0.00")    # a summed-documents impl fails here
```

That last one is the highest-value test in the file: it fails loudly for exactly the
shortcut a tired teammate would take at 03:00.

### 1.2 The rule matrix — reject and accept, every row

| Rule | Reject test | Accept test |
|---|---|---|
| Entry must balance | `UNBALANCED_ENTRY` on a lopsided draft | balanced entry posts |
| Line is one-sided | CHECK rejects debit+credit on one line | debit-only line inserts |
| Posted is immutable | `CANNOT_MODIFY_POSTED` on edit | draft edits fine |
| No double posting | `ALREADY_POSTED` on second call | first call posts |
| Archived account | `ACCOUNT_ARCHIVED` | active account posts |
| Allocation ≤ balance | `OVERALLOCATED_PAYMENT` at total+1 | exact balance pays in full |
| Allocations sum to amount | `ALLOCATION_MISMATCH` | matching sum succeeds |
| Idempotent payment | same key twice → one payment | different keys → two |
| Status transitions | `INVALID_STATUS_TRANSITION` billing a DRAFT PO | CONFIRMED PO bills |
| Accountant cannot modify masters | 403 on `PATCH /contacts/{id}` | Admin `PATCH` succeeds |
| Contact sees only own docs | **404** on another contact's invoice | own invoice returns 200 |
| Tax computed server-side | client-sent total is ignored | server total is authoritative |

> The **404-not-403** case is easy to get wrong and worth an explicit test — a 403 confirms
> the record exists, which leaks data across contacts.

### 1.3 Concurrency — the bug we already shipped once

```python
def test_concurrent_posting_creates_one_entry(db_factory, invoice):
    """Two requests race to post the same invoice."""
    # both must not succeed; the loser gets ALREADY_POSTED, never a duplicate entry
    assert count_entries_for(invoice) == 1
```

Last round the equivalent bug produced a duplicate child row and a duplicate event. Here it
would produce a duplicate journal entry — and the trial balance would still be zero, so
nothing would look wrong. That is precisely why it needs a test.

---

## 2. THE MERGE REVIEW CHECKLIST

Run this on **every** feature branch merging into `dev`.

**Read the diff:**
- [ ] `git diff dev...feature/x --stat` — does the scope match what they said they built?
- [ ] **Unexpected large deletions** → open the file and ask why
- [ ] **Any conflict resolution** → re-read the whole resolved region

> 🚨 **This is the specific failure this role exists to catch.** In the previous
> project a merge silently deleted a function's `def` header. The file still parsed —
> Python attached the orphaned body to the function above it — so nothing failed
> loudly, and a documented setup command stayed broken for weeks. Conflict
> resolutions that "keep both" or "take theirs" can delete a whole feature without a
> single red mark anywhere.

**Then prove it still runs:**
- [ ] `cd backend && uv run pytest` — green
- [ ] `cd frontend && npm run build` — green
- [ ] The app actually **starts** (compiling is not running)
- [ ] **Walk the demo path by hand.** Login → core flow → the wow moment.
- [ ] Nothing that worked before is gone now

**Every few hours:**
- [ ] Does the README's setup still work from a **fresh clone**? (Not your warm one.)
- [ ] Is every mandatory deliverable still present and working?

---

## 3. BEFORE YOU OPEN A MERGE (everyone)

- [ ] Tests pass locally
- [ ] `npm run build` passes if you touched the frontend
- [ ] Conventional commit messages, scoped, no AI trailers
- [ ] You can **explain every line you wrote** — the organizers explicitly warn against
      un-understood AI code, and a judge may ask
- [ ] You updated `04_API_CONTRACT.md` if you changed an endpoint
- [ ] No secrets, no `.env`, no `node_modules`

---

## 4. AUTHORITY

The reviewer can **hold or reject** any merge. `dev` staying green is worth more than
one extra feature landing early.

**Revert beats debug when you're tired.** If `dev` breaks and the author is asleep,
revert the merge and let them fix it when they're up. Do not try to repair someone
else's half-finished work while exhausted — that is how a working demo becomes a
broken one.

---

## 5. USEFUL SKILLS

- `code-review` — structured review of a diff
- `resolving-merge-conflicts` — for exactly the failure described above
- `webapp-testing` — drives a real browser to verify the UI actually works

See `11_AI_TOOLING.md`.
