# Docs describe a built platform that doesn't exist in this repo yet

### What happened
`docs/02_ARCHITECTURE.md`, `docs/12_SESSION_CONTEXT.md` and others describe a working
platform layer as fact — "32 backend tests passing," "frontend build green," specific files
under `backend/src/app/` and `frontend/src/`. A live check
(`git ls-tree -d --name-only <branch>` on `main`, `dev`, `dev-feature`, `feature/fe-design`)
found **no `backend/` or `frontend/` directory on any branch** — only `ai_guidelines/` and
`docs/` are tracked anywhere in this repository as of this date.

### Why
The docs were written as a target-state plan/spec before the scaffold was committed (or it
exists only on someone's machine, untracked). Either way, a doc claiming a test count is not
the same claim as the test count being true right now.

### Fix
Don't trust a doc's own claim about running code without checking git first
(`ai_guidelines/UNIVERSAL_AI_RULES.md` §9 — verify derived facts before publishing them).
`brain/pending/INDEX.md` Phase 0 treats scaffolding the boilerplate as **open work**, not
done, until it's actually verified present and passing on a branch.

### Prevention
Before writing a `done/` entry claiming something is built, run the verification command
yourself (`git ls-files`, `pytest`, `npm run build`) rather than copying a claim from another
doc, even one of ours.

---
### Resolved — 2026-09-05, later the same day
`backend/` and `frontend/` now exist (merged from `dev`). Both platform claims re-checked and
now genuinely true: `uv run pytest` → 32 passed; `npm install && npm run build` → compiles
clean. Full detail: [`../done/2026-09-05-platform-and-schema-verified.md`](../done/2026-09-05-platform-and-schema-verified.md).
Kept this entry rather than deleting it — it's the exact shape of claim worth re-verifying
every time a doc says something is "done."
