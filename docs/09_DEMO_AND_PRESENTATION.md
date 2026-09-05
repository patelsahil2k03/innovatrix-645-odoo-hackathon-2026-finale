# 09 — DEMO, VIDEO & PRESENTATION

> **Owner:** the reports & pitch lane. **This is a graded deliverable, not an afterthought.**

The finale has **two** narrative deliverables the virtual round didn't: a video *and* a live
presentation. Code that nobody understands scores worse than slightly less code that is
explained well.

---

## 1. THE CORE PROBLEM WITH DEMOING AN ACCOUNTING SYSTEM

**A ledger is invisible.** A judge watching an invoice get created sees a form and a table —
identical to what a team who stored balances on the invoice row would show. Everything that
makes this build good happens where nobody can see it.

**So the entire demo strategy is one idea: make the ledger visible.** Every beat below
exists to show that the accounting is real rather than drawn.

Three devices do the work:

1. **The trial-balance badge** in the shell — `Trial balance 0.00 ✓`, visible on every
   screen, recomputed live on every posting.
2. **The posting preview** — the journal entry shown *before* the document is committed.
3. **The drill-down** — any report figure opens the journal lines and then the source
   document.

If those three work, the demo writes itself. If they don't, no script saves it.

---

## 2. THE VIDEO (~5 minutes)

**Production:** record the **browser, not the IDE** — they asked for functional flow, not a
code tour. One narrator (the clearest speaker). App pre-seeded via
`./scripts/demo-reset.sh --yes` and pre-warmed. Upload unlisted, then **test the link in an
incognito window before submitting.**

| Segment | Length | Content |
|---|---|---|
| **Hook + problem** | 0:25 | *"Every business runs on two questions: what do we own, and what do we owe. This is a full double-entry accounting system for a furniture business, built in 24 hours."* |
| **Master data, fast** | 0:30 | Contacts, products, chart of accounts — move quickly. This is setup, not the story. Say *"these accounts are what every transaction gets classified into."* |
| **The star flow** | 1:15 | Sales Order → Invoice → **pause on the posting preview** → Post → Payment. Say the words: *"before I post this, the system shows me the exact accounting entry it's about to make — debit Debtors, credit Sales and Tax. They balance."* |
| **The proof** | 0:40 | Open the Balance Sheet. Click a figure → the accounts → the journal lines → **the invoice we just created**. *"Nothing here is stored on the invoice. Every number on this report is computed from the ledger."* |
| **Live data** | 0:20 | Leave the dashboard open; a payment posts on its own. Cash rises, receivables fall, the trial balance re-asserts. *"This is live from our database — nothing here is hardcoded."* |
| **Robustness** | 0:45 | Submit an invoice with no lines → inline error. Try to edit a posted invoice → refused. Try to over-allocate a payment → `OVERALLOCATED_PAYMENT`. Then resize to mobile. Hits two criteria in 45 seconds. |
| **Under the hood** | 0:30 | Architecture diagram. Stack in one line. Point at the contributor graph. |
| **Close** | 0:15 | Team name, thanks. |

**Two segments people skip and shouldn't:** the live-data moment and the deliberate invalid
submission. Both map directly onto published judging criteria, and both take under a minute.

**The deliberate failure to demo** is the *edit a posted invoice* one. It is the most
convincing thirty seconds available to us, because a system that refuses to let you rewrite
history is unmistakably an accounting system.

---

## 3. THE LIVE PRESENTATION

The pitch owner drives, but **every member must be able to answer for their own area.**

**Structure (adapt to the time given):**
1. The problem, in one sentence — no preamble
2. What we built — the demo, live if the setup allows, recorded as a fallback
3. How it works — architecture in ~60 seconds, no code
4. What we'd do next — shows judgement, and pre-empts "what's missing?"

### Prepare real answers for these

| Question | The answer we actually have |
|---|---|
| *"What was the hardest part?"* | Getting posting to be the **only** write path into the ledger, and locking the row before re-checking status — a duplicate journal entry leaves the trial balance at zero, so the books are wrong and nothing looks wrong. |
| *"What would you do with another week?"* | Bank reconciliation, multi-currency with FX gain/loss, and fiscal-year closing entries — named in our out-of-scope list, not invented on the spot. |
| *"Why this stack?"* | Postgres because `SELECT … FOR UPDATE` silently does nothing on SQLite, and we rely on row locks. We can show the compiled SQL for both. |
| *"Did you use AI? Do you understand this code?"* | Yes, and here is the posting function — then **explain it**. Note that our anomaly and duplicate detection are deterministic and cite their own rows, precisely so nothing is a black box. |
| *"Is the balance sheet real, or are you summing invoices?"* | Drill down, live. This is the question we most want to be asked. |

**Have a fallback.** If live demo setup fails, play the recorded video. Never spend
presentation minutes debugging in front of judges.

---

## 4. INSURANCE

- Screenshots of every screen, captured before the freeze
- The recorded video, downloaded locally as well as uploaded
- A one-page architecture diagram, exported as an image
- The demo database in a known-good, reset state (`./scripts/demo-reset.sh --yes`)
- **A printed copy of the four posting rules** — if a judge asks how a specific document
  posts, answering from memory beats scrolling through code

---

## 5. WRITING THE SCRIPT

Write it once the app actually exists — not from the plan. Rehearse it **out loud, with the
app open**, at least once. Reading it silently hides every awkward transition and every
screen that takes four seconds to load.

**Rehearse the drill-down specifically.** It is our best moment and the easiest to fumble,
because it is three clicks deep and each one has to land on the right row.

Trim the middle, never the close.
