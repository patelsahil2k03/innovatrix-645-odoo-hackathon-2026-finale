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

## 8 · Frontend architecture — components & state
- **One shared component per UI element.** Every reusable piece (button, input, card, table
  row, whatever) lives once under `frontend/src/components/ui/` — extends the primitives
  already named in `docs/05_FRONTEND.md` §3. A page never hand-rolls a second version of
  something that already exists there; add it to `components/ui/` first, then use it.
- ⚠️ **State management: ON HOLD, 2026-09-05.** Redux was proposed, then paused the same
  day — *"do not add redux for now."* Do **not** install `@reduxjs/toolkit` or
  `react-redux`, do not treat Redux as decided. `docs/02_ARCHITECTURE.md` §7 /
  `docs/05_FRONTEND.md` §5's existing hooks-based pattern (`useFetch`, `usePagedRows`)
  stands until a replacement is actually decided.
- **No business logic inside `.tsx` files — this part stands regardless of the mechanism.**
  A component may only: read an already-computed value, render markup, call/dispatch an
  action. Every calculation and every branch with business meaning — is this invoice
  overdue, is this budget over plan, which totals to show, which button to disable and why
  — lives outside the component: in a hook, a context reducer, or a future state layer.
  Never inline in JSX or in the component function body.
- **Whatever the eventual state layer is, it decides; the component only renders the
  decision.** If a `.tsx` file needs an `if` to decide something a user would call "a rule,"
  that logic is in the wrong file.

## 9 · Explicitly told to remember
Append every future "remember this" here, verbatim, dated, in the user's own words.
Append-only — never let one quietly drop when this file is otherwise edited.

### 2026-09-05
> "for FE make common component for core component and use only this component and also
> use redux for state management and also handle all data flow and condition reducer only —
> don't want any UI logic in tsx file, only redux file can understand what things we need
> to pass to the UI and how UI react, so all data changes and make simplify as per UI
> requirement, send only all calculation only for reducer"

See §8 above for the structured rule this became.

### 2026-09-05 (later same day)
> "do not add redux for now"

The Redux part of the rule above is paused, not deleted — see §8's "ON HOLD" note. The
component-reuse and no-business-logic-in-`.tsx` principles still stand.
