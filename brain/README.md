# 🧠 Project Brain

Read this first. It routes you to the right file — it is not a summary of all of them.
Don't open everything "to be safe"; that defeats the design.

**`docs/`** = the spec, frozen once locked. **`brain/`** = the working memory: what's fixed,
what's open, what mistakes cost time, every governing rule, in one place. Update `brain/`
constantly as the build happens; `docs/` barely moves.

One-time onboarding brief: `docs/12_SESSION_CONTEXT.md`. This folder is what keeps that
brief from going stale as real work happens on top of it.

---

## Read selectively, not exhaustively

| File | Read it when | Tag |
|---|---|---|
| [`RULES.md`](RULES.md) | Every session, before code or git. Auto-loaded via `CLAUDE.md`'s `@brain/RULES.md`. | 🔵 |
| [`mistakes/`](mistakes/) | Before touching an area that's bitten us before. Read the index table, open only the 1–2 files it points to. | 🔴 |
| [`pending/`](pending/) | Before picking up work — what's open, what's next. | 🟡 |
| [`done/`](done/) | To check whether/how X already exists, before redoing it. | 🟢 |

`RULES.md` stays a single file, read in full every time. `mistakes/`, `pending/`, `done/` are
folders because they grow without bound over a 24-hour build: an `INDEX.md` table (one line
per item) plus one small file per item. Same shape as an LLM's own working memory — index
first, detail only on demand, never the whole folder at once just to answer one question.

**Why this shape.** Context is finite and costly — retrieve what's needed just-in-time,
don't pre-load "in case." (Anthropic, [*Effective context engineering for AI
agents*](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents).)
Reading all of `mistakes/` to answer one question burns the same budget a person would waste
replaying every memory they have to answer one question.

**Tags**, consistent everywhere in this folder:
- 🔴 avoid — a mistake, a trap, something that broke
- 🟡 open — not resolved, actionable
- 🟢 confirmed-good — done, verified, keep doing it this way
- 🔵 standing fact/rule — not a task, just something true that must not be forgotten

---

## Before you create anything
1. Read `../docs/02_ARCHITECTURE.md` then `../docs/03_DATA_MODEL.md`. Every 🔴 entry that
   involves rebuilding something already specified exists because this step got skipped.
2. Check `RULES.md` for whatever gates the action you're about to take.
3. Check `mistakes/INDEX.md` for your area — search it, don't skim top to bottom.
4. Open `pending/INDEX.md`, and start.

## Lifecycle of an item in this brain
```
mistake happens        → mistakes/YYYY-MM-DD-slug.md now + a row in mistakes/INDEX.md
task identified         → a row in pending/INDEX.md (own file only once it outgrows a checklist)
task fixed/built        → done/YYYY-MM-DD-slug.md (why/how/verified) + a row in done/INDEX.md
                          → then DELETE the row from pending/INDEX.md. Never in both at once.
"remember this"          → RULES.md § 8, verbatim, dated, append-only
```

**Keep it lean.** Each `mistakes/` or `done/` file is small by construction — the *folder*
grows, not the file. If an `INDEX.md` table itself gets hard to scan, split it by area rather
than let it bloat. Never delete a 🔴 entry silently — retire one only once the bug class is
structurally impossible (a constraint, a test), never just "hasn't recurred lately."

## Verify before trusting a claim here — including this one
A `done/` entry is a claim made at a point in time, not a live query. Check it
(`git ls-files`, run the test, load the screen) before acting on it —
[`ai_guidelines/UNIVERSAL_AI_RULES.md`](../ai_guidelines/UNIVERSAL_AI_RULES.md) §9. This
folder caught exactly that gap on day one:
[`mistakes/2026-09-05-docs-vs-repo-state-gap.md`](mistakes/2026-09-05-docs-vs-repo-state-gap.md).
