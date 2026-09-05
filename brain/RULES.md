# 🔵 RULES — constitution

Read in full, once per session — this file is imported automatically via `CLAUDE.md`'s
`@brain/RULES.md`, so it's already in context; don't skip it anyway. Terse on purpose: full
reasoning is linked, not repeated here.

## 1 · Approval gates
- Never commit/push without being asked. No exceptions. Doesn't expire mid-session.
- Ask before: deleting anything, installing a dependency, editing config, force-push,
  deleting a branch, starting/restarting a dev server.
- A batch approval covers only that batch — not the next one, not a future session.

## 2 · Git — this repo's overrides
- **No AI trailers in commits, ever** — not `Co-Authored-By`, not `Signed-off-by`, even if a
  tool defaults to adding one. Conflict → flag it, don't silently pick a side.
- Conventional commits. Imperative mood. No AI/tool mention anywhere in the message.
- Only `main` + `dev` are permanent. Feature branches: `feature/<what>`, never a person's
  name.
- `main` = demo-ready. `dev` = integration. Every merge into `dev` is reviewed.
- Before any destructive git command (`checkout`/`restore`/`reset`/`clean`) → `git status`
  first, always.

## 3 · The one system-defining rule
> Documents never store a balance a report reads. Documents *post*; reports *aggregate*.

`services/posting.py` = the only writer of `journal_lines`. Not a router. Not the simulator.
Not the seed script. One more write path and the whole guarantee is gone.

## 4 · Contract-first
`docs/04_API_CONTRACT.md` changes before the code, never after. New error code → a row in
its §4 registry the moment it's invented.

## 5 · Locking discipline
Lock the row → re-check status *after* the lock → mutate → commit → publish the event. That
order, always. A pre-lock check is a check against a value that may already be stale — see
`mistakes/carried-forward-virtual-round.md`.

## 6 · Docs discipline
`docs/` = spec, changes rarely. `brain/` = memory, changes constantly. Session chatter,
`*_COMPLETE.md` files → never committed, anywhere. Discuss in chat, or it becomes a real
`done/` entry.

## 7 · House style, condensed
- Money: `Numeric(12,2)`, never `Float`. Dates: UTC always — never mix with `date.today()`.
- A posted document is immutable. Corrections are a reversing entry, never an edit.
- Reports aggregate `journal_lines`. Summing a document table = blocking review comment.
- KPI totals read the API's `total`, never `items.length`.
- Every search box is debounced before it enters a fetch's dependency list.

## 8 · Explicitly told to remember
Append every future "remember this" here, verbatim, dated, in the user's own words.
Append-only — never let one quietly drop when this file is otherwise edited.

*(none yet)*
