# Carried forward from the virtual round

Already designed around in this boilerplate — don't reintroduce them once the code exists.
Full detail: [`../../docs/10_LESSONS.md`](../../docs/10_LESSONS.md). One-line index so you
don't have to open it unless one of these looks relevant to what you're touching.

- A merge silently deleted a function header; the file still parsed, nothing failed loudly
  → read every conflict resolution in full, don't trust "it still imports."
- A state transition checked status *before* locking the row → duplicate writes under
  concurrency → lock, then re-check (see `../RULES.md` §5).
- KPI tiles used `items.length` instead of the API's `total` → wrong past page one.
- Search had no debounce or abort → race conditions, one API call per keystroke, stale
  results overwriting fresh ones.
- The modal had no focus trap, no Escape handling, no dialog role.
- Tabs were fake `<a href="#">`s; sortable headers had no `aria-sort`.
- Tests used local `date.today()` against a UTC-based app → failed depending on time of day
  on any machine ahead of UTC.
- `zod` was installed but never actually used for validation, despite a doc claiming it was.
- `docs/` was gitignored while committed READMEs linked into it → dead links on a fresh
  clone.
- `passlib` is dead and incompatible with modern `bcrypt` → call `bcrypt` directly, don't
  inherit a dependency pin blindly.
