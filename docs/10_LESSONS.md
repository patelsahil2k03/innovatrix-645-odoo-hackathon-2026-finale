# 10 — LESSONS FROM THE VIRTUAL ROUND

> **Read this before you write any code.** These are mistakes we already paid for,
> found by a full audit of the qualifying project. Every one is either already fixed
> in this boilerplate or is a habit you need to carry in.

The virtual-round project (a fleet-operations platform) qualified — it was good work.
These are the cracks a proper audit found afterwards, which is exactly the sort of
thing that costs points when someone looks closely.

---

## 🔴 The two that actually broke things

**1. A merge silently deleted a function header.**
A `def main():` line vanished during a merge. Python attached the orphaned body to the
function above it, so the module still imported and **nothing failed loudly** — but
the documented first-run command was broken, and stayed broken for weeks because no
test ever imported that file.

→ *Fixed here:* `tests/test_seed_smoke.py` imports and runs the real entry point, and
`python -m app.seed --help` is executed as a subprocess in CI.
→ *Habit:* the reviewer reads every conflict resolution in full (`07` §2).

**2. A state transition never locked the row it was mutating.**
The dispatch logic locked the *related* rows but not the record it was changing, and
never re-checked status after acquiring locks. A background task and a user request
could both pass the guard and double-apply — duplicate child record, duplicate event.
The module's own docstring claimed this was impossible.

→ *Fixed here:* `services/rules.py` ships `lock_row` / `require_status` and documents
the lock → re-check → mutate → commit → publish order.
→ *Habit:* a check made before the lock is a check against a stale value.

---

## 🟠 The ones that were visibly wrong

**3. Totals under-reported past the first page.** KPI tiles used `items.length` on a
200-row-capped fetch instead of the API's `total`. Every count silently wrong beyond
one page. → *Fixed:* `Page<T>.total` is documented in `api.ts`, `<Pagination>` and
`<KpiGrid>` both say so, and a test asserts `total > items.length`.

**4. Search had a race condition.** No abort or sequencing, so a slow earlier request
could resolve last and overwrite fresh results with stale ones. → *Fixed:* `useFetch`
guards against out-of-order resolution; `useDebouncedValue` exists and is documented
as mandatory for search inputs.

**5. Every keystroke fired an API call.** No debouncing anywhere. → *Fixed:* see above.

**6. The modal had no focus trap, no Escape, no dialog role.** Keyboard users could
tab out of an open dialog into the page behind it; screen readers never announced it.
Affected every dialog in the app. → *Fixed:* `<Modal>` handles all of it.

**7. Tabs were `<a href="#">` with `preventDefault`.** Not semantically tabs, not
keyboard navigable. Sortable headers had no `aria-sort`, so the sort direction was
sighted-only. → *Fixed:* `<Tabs>` and `<SortableTh>`.

---

## 🟡 The ones that made the repo look unfinished

**8. Tests failed on IST machines.** Tests used local `date.today()` while the app
used `datetime.now(UTC)`. On any machine ahead of UTC, three tests failed depending on
the time of day. → *Habit:* UTC everywhere, both sides.

**9. `zod` was installed but never used** — while a doc claimed client-side zod
validation existed. → *Fixed:* `validation.ts` actually uses it.

**10. Documentation drifted from the code.** The API contract was missing real
endpoints and promised an error-code list it never provided. The architecture doc
still described a stack the team had moved off. → *Habit:* the contract changes
**before** the code (`04` §5).

**11. Docs referenced files that didn't exist in a fresh clone.** `docs/` was
gitignored, but two committed READMEs linked into it — an evaluator cloning the repo
hit dead links. → *Fixed:* flagged directly in `.gitignore` with instructions to
resolve it before the first commit.

**12. A stale one-off session note sat committed at the repo root**, contradicting
the team's own convention of keeping working notes out of the submission.
→ *Habit:* session artefacts don't get committed.

---

## 🧯 Process lessons

**13. Duplication of UI markup.** The same search box was hand-written on six pages,
the same table scaffolding on eight. → *Fixed:* shared primitives, and the rule is to
use them.

**14. Advertised features that didn't exist.** The settings screen listed capabilities
("acknowledge alerts", "view audit log") with no implementation behind them.
→ *Habit:* if the UI claims it, it works — or the claim comes out. A judge who clicks
a dead capability remembers it.

**15. `passlib` would have broken the build today.** It was last released in 2020 and
is incompatible with modern `bcrypt`. It worked then only because of an old pin.
→ *Fixed:* this boilerplate calls `bcrypt` directly. Verify dependency health before
depending on it — don't inherit pins blindly.

---

## The one-line version

> The failures that hurt weren't hard bugs — they were **quiet** ones: a silent merge
> deletion, a check against a stale value, a total that was wrong only past page one,
> a doc that stopped matching the code. Build so that breakage is **loud**, and review
> so that silence gets checked.
