# CLAUDE.md

Read first, every session. Map only — content lives in `brain/` and `docs/`.

**Project:** Urban Furniture — Accounting System. Odoo Hackathon 2026 finale, Team
Innovatrix #645. Double-entry ledger. FastAPI + SQLAlchemy backend, Next.js + TypeScript
frontend. Spec: `docs/00_PLAYBOOK.md` → `docs/PROBLEM_STATEMENT.md`.

@brain/RULES.md

**Read next, in order:**
1. `brain/README.md` — living memory index. Read selectively, not all of it.
2. `docs/02_ARCHITECTURE.md` + `docs/03_DATA_MODEL.md` — before any model, router, screen.
3. `ai_guidelines/` — the 3 rulebooks. Once, in full.

**5 rules that must never break, even on a fast skim:**
1. Never commit/push without being asked. No exceptions, no expiry.
2. No AI trailers in commits (`Co-Authored-By`, etc.) — repo overrides any tool default.
3. `services/posting.py` is the only writer of `journal_lines`. Ever.
4. `docs/04_API_CONTRACT.md` changes before the code. Never after.
5. Lock row → re-check status *after* the lock → mutate → commit → publish. That order,
   always.

**Approval format** — defined once, here, so nothing else duplicates it:
```
📋 PROPOSED ACTION
What / Why / Impact / Risk / Rollback
Files affected: ...
Proceed? (yes/no)
```

**Conflict rule:** `brain/RULES.md` wins on *how to act*. `docs/00_PLAYBOOK.md` wins on
*what was decided*. This file is the map, not a third source of truth.
