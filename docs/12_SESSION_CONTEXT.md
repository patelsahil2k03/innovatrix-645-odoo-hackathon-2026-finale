# 12 — SESSION CONTEXT & HANDOFF

> **Purpose:** everything a new AI session (or a teammate) needs to pick this project
> up cold, without re-deriving decisions or re-litigating settled questions.
> **Read this first if you have no prior context on this repository.**

---

## 1. WHAT THIS IS

A **hackathon starter template** for Team Innovatrix's Odoo Hackathon 2026 **final
round** (24 hours, on-site, Gandhinagar). The team qualified via a virtual round with
a fleet-operations platform called **TransitOps**, which lives in a sibling directory:
`../innovatrix-odoo-hackathon-2026/`.

The problem statement for the finale is **not known in advance**. This repository
therefore contains only what is true regardless of the domain: auth, RBAC, error
contract, pagination, real-time, audit trail, design system, and the strategy docs.

**Team (4):** Sahil Patel (lead), Devasya Joshi, Gaurav Rathva, Pranjal Shah.

---

## 2. HARD CONSTRAINTS — DO NOT VIOLATE

| Constraint | Detail |
|---|---|
| ⚠️ **Never commit unprompted** | The repository is live, but **no commit or push happens without the lead asking for it.** Propose the plan, wait for approval, then execute. This gate does not expire. |
| 📦 **Published, private** | Remote is `patelsahil2k03/innovatrix-645-odoo-hackathon-2026-finale`, **private**. Published in stages — foundation first, then code — never one bulk commit. |
| 🌿 **Branch structure** | `main` (demo-ready) ← `dev` (integration) ← `feature/*`. Only `main` and `dev` are pre-created; feature branches get made as the work appears, named after the work rather than a person. Nothing lands directly on `main`. |
| 🚫 **Don't over-lock the stack** | Explicitly requested. The DB is a one-variable switch (SQLite ⇄ Postgres), Docker is optional, and `01_STACK.md` lists what stays open until the statement lands. |
| 🚫 **No timeline language in source code** | Wall-clock/hackathon-schedule references belong in `docs/`, not in code comments. This was corrected once; keep it clean. |
| ✅ **Follow `ai_guidelines/`** | Three rulebooks, copied into this repo: AI rules, cleanup/reorg rules, git rules. They govern approval gates, safe deletion, commit format. |

---

## 3. DECISIONS MADE, AND WHY

**Stack kept from the virtual round** (FastAPI + Next.js) — the team has shipped with
it. Versions were re-verified live against npm/PyPI rather than inherited.

**Three dependency landmines found and handled:**
- `passlib` is **dead** (last release 2020) and breaks against modern `bcrypt` (it
  reads `bcrypt.__about__`, removed in 4.1+; current is 5.x). The previous project
  used it. → This boilerplate calls `bcrypt` directly.
- **TypeScript 7** and **ESLint 10** are current but are major rewrites → pinned to
  `^5` and `^9`. A toolchain migration during a 24-hour build is pure downside.
- **`sse-starlette` jumped 2.x → 3.x** → pinned `~=3.4`, and the events router was
  rewritten to let the library own heartbeats (hand-rolling one fights it).

**No throwaway example domain entity.** Considered and rejected as dead weight the
team would delete immediately. Instead: the auth/role/audit/notification tables are
*real and permanent*, and serve as the reference CRUD pattern, backed by written
recipes in `06_BACKEND.md`. Also rejected: a code-generator script (a broken generator
mid-hackathon is worse than no generator).

**Team split is 2 frontend / 1 backend / 1 QA-reviewer** (the lead's choice), not the
virtual round's 4-way concern split. Consequence: **backend is the bottleneck** — the
role cards say explicitly that seed data and analytics work shifts to the floater or
QA person.

**`docs/` and `ai_guidelines/` are tracked**, reversing the previous project's
convention. That convention caused the dead-link bug in `10_LESSONS.md` §11, and it
also meant teammates could not get the playbook or their role card from a clone. The
repository is private, so nothing here is public regardless.

---

## 4. WHAT IS BUILT AND VERIFIED

**Backend — 32 tests passing** (`cd backend && uv run pytest`)
App factory, settings, DB session, error envelope, bcrypt hashing, JWT + shared token
extraction, RBAC dependency factory, pagination/sort/search with allowlists, SSE hub,
audit middleware, CSV export, User/Role/AuditLog/Notification models, health/auth/
events/notifications/audit-log routers, rule-engine helpers (`lock_row`,
`require_status`, `emit`), simulator skeleton, deterministic seed with Indian data
generators.

**Frontend — build green** (`cd frontend && npm run build`)
Design system (light+dark, single-variable re-theme, no flash), app shell with sidebar
and live indicator, login page with inline validation, dashboard example, typed API
client with `ApiError`, auth context with route gating, hooks (`useFetch`,
`useDebouncedValue`, `useEventStream`, `usePagedRows`), Zod validation, and nine
accessible UI primitives.

**Real-time — verified against a real uvicorn server** (`./scripts/verify-sse.sh`),
which prints `event: connected` followed by live `kpi.refresh` frames.

> ⚠️ **Known limitation, already investigated — do not re-debug this.** The SSE stream
> **cannot** be tested in-process. `EventSourceResponse` uses anyio task groups that
> neither starlette's `TestClient` (background-thread portal) nor `httpx.ASGITransport`
> (buffers the whole body) can drive; both hang on an endpoint that never finishes.
> This is a harness limitation, not a bug. The hub's logic is unit-tested; the wire
> format is verified by the script. This was chased further than it deserved once
> already — don't repeat it.

**Also found and fixed during the build:** Next.js 16 removed the `eslint` key from
`next.config.ts` (and `next lint`); leaving it in is a hard build error.

---

## 5. WHAT IS DELIBERATELY NOT BUILT

The entire domain layer. `models/domain.py`, `schemas/domain.py`,
`routers/domain.py` and `services/rules.py` exist with `★` markers and worked
examples in their docstrings, but no domain tables, endpoints or screens. That is
correct — it gets written once the problem statement is known.

Also not built (intentionally): charts (pick a library once you know what's needed),
file uploads, maps, and anything else domain-shaped.

---

## 6. WORKING STYLE THAT'S BEEN ESTABLISHED

Observed preferences from the sessions so far — worth honouring:

- **Recommend and proceed.** Ask only decision-shaping questions, then act. Don't
  ask for approval on every file.
- **Push back on over-engineering.** The lead does this, and is usually right.
  Timebox debugging; when a check already answers the question, stop.
- **Verify, don't assert.** Run the test, curl the endpoint, read the output. "It
  should work" is not a status.
- **Correct course plainly** when wrong — no lengthy apologies, just fix it and move on.
- Prefer fewer, better files over more files.

---

## 7. WHERE THINGS ARE

```
innovatrix-odoo-hackathon-2026-finale/
├── ai_guidelines/     3 rulebooks (AI · cleanup · git)
├── docs/              00 playbook → 12 this file, + team/ role cards
├── backend/           FastAPI, 32 tests passing
├── frontend/          Next.js, build green
├── infra/             optional Postgres compose
└── scripts/           dev.sh · demo-reset.sh · verify-sse.sh
```

AI skills are **not** vendored — `.claude/` is gitignored, since the skills are
third-party content and one of them is explicitly source-available-but-not-open-source.
Each person installs their own; the short list, the install commands, the rationale and
the explicit *not installed* list are in `11_AI_TOOLING.md`.

---

## 8. WHAT HAPPENS NEXT

**When the problem statement is released:**
1. Paste it verbatim into `docs/PROBLEM_STATEMENT.md`
2. Run the triage protocol in `00_PLAYBOOK.md` §5 (the reading hour — no code)
3. Fill in the domain model, then the API contract (`04`), then build
4. Follow the per-resource recipe in `06_BACKEND.md`

**Immediate, if anyone wants to prepare further:** dry-run the boilerplate against an
invented problem statement to time how fast it adapts. That's the only meaningful
rehearsal left.

---

## 9. PARKED WORK — the sibling project

`../innovatrix-odoo-hackathon-2026/` (TransitOps, the qualifying entry) has **an
audit completed and a 14-task fix plan written, with zero tasks executed.**

- Branch `fix/production-readiness` exists and is pushed; `main` is untouched
- Plan: `docs/superpowers/plans/2026-08-13-transitops-production-readiness.md`
- Full findings: `docs/10_PROJECT_REFERENCE.html`
- Agreed approach: one commit per task, each approved individually
- **Out of scope by explicit instruction:** no branch deletion, no history rewriting,
  and credential/security items (default JWT secret, no rate limiting, cookie-secure
  off) are **documented, not fixed** — the repo may be run by evaluators with those
  known values
- Two critical items lead the plan: a seed script broken by a lost `def main():`, and
  an unlocked row in a state transition

That work resumes **after** the finale.
