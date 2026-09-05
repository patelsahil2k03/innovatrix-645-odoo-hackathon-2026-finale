# WORKING LANES

> **This is reference, not an assignment.** Nobody owns a lane, nobody owns a branch.
> Pick up whatever is most useful, and say in the group chat what you're taking so two
> people don't write the same file.
>
> Branch naming: `feature/<what-you-are-building>` off `dev`. Named after the work, never
> after a person. Create them as you need them.

Everything cross-cutting is documented once, elsewhere. This file only covers what is
specific to each lane:

- Commit and branch conventions → [`../00_PLAYBOOK.md`](../00_PLAYBOOK.md) §8
- Merge review checklist → [`../07_TESTING_AND_REVIEW.md`](../07_TESTING_AND_REVIEW.md) §2
- API contract → [`../04_API_CONTRACT.md`](../04_API_CONTRACT.md)
- Mistakes already paid for → [`../10_LESSONS.md`](../10_LESSONS.md)

---

## Lane 1 · Frontend core

**Mission:** every screen on the demo path looks finished, works at three widths, and
rejects bad input inline.

**Covers:** design tokens (locked early, never changed after) · app shell and navigation ·
the master-data and document screens · client validation · loading, empty and error states.

**First three, in order:**
1. **Design tokens** into `design-system.css`. One commit. Frozen after this.
2. **App shell** — sidebar grouped as in [`../05_FRONTEND.md`](../05_FRONTEND.md) §2,
   plus the login screen.
3. **Customer Invoices — list, form and detail.** This is the demo path and the template
   every other document screen copies. Get it right once, then duplicate.

**Lane-specific rules:** money is right-aligned and tabular · debits and credits are two
columns, never one signed column · never compute a total in JavaScript · a posted document
is read-only in the UI as well as the API.

---

## Lane 2 · Backend core

**Mission:** every accounting rule is enforced server-side, inside a transaction, and
provably rejects bad input.

**Covers:** models and migrations · **the posting engine** · routers per the contract ·
RBAC wiring · SSE events after commit.

**First three, in order:**
1. **Chart of Accounts, Journals, and the two ledger tables** with their CHECK constraints.
2. **`services/posting.py`** — `post_entry()` and `reverse_entry()`, with the invariant
   tests from [`../07_TESTING_AND_REVIEW.md`](../07_TESTING_AND_REVIEW.md) §1.1.
3. **The sales chain end to end** — SO → Invoice → post → Payment. One finished vertical
   slice before starting the purchase chain.

**Lane-specific rules:** `services/posting.py` is the **only** module that writes
`journal_lines` · lock the row, then re-check status *after* the lock · publish events
after commit, never before · reports aggregate the ledger and never sum documents.

Full recipe: [`../06_BACKEND.md`](../06_BACKEND.md).

---

## Lane 3 · Reports, dashboard & the pitch

**Mission:** own the story the judges hear — and be the second pair of hands wherever the
team is slowest.

**Covers:** the dashboard KPIs and the four report screens · the drill-down (our one "wow")
· the demo script, the video, the live presentation · the README kept truthful.

**Also covers the overview job** nobody else has: every couple of hours, check that the
demo path still works end to end, that nothing mandatory is unbuilt, and that nobody is
silently stuck.

**Priority when everything competes:**
1. The demo path works
2. The video ships
3. Your own report screens
4. Overflow help

**If something must drop, drop your own screens — never the video.** A missing chart costs
a few points; a missing video submission is a zero.

Full detail: [`../09_DEMO_AND_PRESENTATION.md`](../09_DEMO_AND_PRESENTATION.md).

---

## Lane 4 · QA, review & merge gatekeeping

**Mission:** nothing reaches `dev` that breaks, silently removes, or quietly regresses
something that already worked.

**Covers:** reviewing every merge into `dev` · the invariant and rule tests · git hygiene ·
backend overflow when Lane 2 is the bottleneck.

**The specific failure this lane exists to prevent:** in the virtual round a merge silently
deleted a function header. The file still parsed, so nothing errored, and a documented
setup command stayed broken for weeks. **Changes that don't fail loudly are the enemy.**

**In this system that risk is sharper.** A duplicated journal entry leaves the trial
balance at zero — the books are wrong and nothing looks wrong. Read every conflict
resolution in full.

**Test priorities:** ledger invariants → business rules (reject *and* accept) → error
envelope → the demo path. Do not chase coverage.

**Authority:** hold or reject any merge. `dev` staying green is worth more than one extra
feature landing early. **Revert beats debug when everyone is tired.**

Checklist: [`../07_TESTING_AND_REVIEW.md`](../07_TESTING_AND_REVIEW.md) §2.

---

## Priming an AI assistant

Whichever lane you're in, give it this and then your task:

> I'm building an accounting system for a hackathon — double-entry ledger, FastAPI +
> SQLAlchemy 2.0 backend, Next.js App Router + TypeScript + Tailwind v4 frontend. Auth,
> RBAC, pagination, error envelope and SSE are already built. Money is `Numeric(12,2)`,
> dates are UTC. Every document posts one balanced journal entry through a single service;
> reports aggregate journal lines and never sum documents. Errors use
> `{error:{code,message,fields}}`. My contract is [paste from 04_API_CONTRACT.md].
> Build [task] with me, and explain anything I couldn't defend to an evaluator.

**Never commit a line you cannot explain.** The organizers call this out explicitly, and
you may be asked directly at the presentation.
