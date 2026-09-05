# 12 — SESSION CONTEXT & HANDOFF

> **Purpose:** everything a new AI session (or a teammate) needs to pick this project up
> cold, without re-deriving decisions or re-litigating settled questions.
> **Read this first if you have no prior context on this repository.**

---

## 1. WHAT THIS IS

Team Innovatrix's build for the Odoo Hackathon 2026 **final round** (24 hours, on-site,
Gandhinagar). The team qualified via a virtual round with a fleet-operations platform
called **TransitOps**, which lives in a sibling directory:
`../innovatrix-odoo-hackathon-2026/`.

**The problem statement is decided: Urban Furniture — Accounting System.** A double-entry
accounting system. Two rejected alternatives (DealFlow360, PeoplePay360 HR & Payroll) and the
reasoning behind the choice exist only as local, gitignored working material — not part of
the tracked repository, per the internal-material rule in §2.

**There are two authoritative sources for the build, not one.** The PDF and an Excalidraw
mockup linked at its end — the mockup is considerably more specific, and where the two
disagree it wins. See [`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md) §4 for every place that
mattered; it corrected the account types, the analytic model, the budget workflow, sign-up,
and more.

**Team (4):** Sahil Patel (lead), Devasya Joshi, Gaurav Rathva, Pranjal Shah.
**Product name: still open** — candidates in [`README.md`](README.md).

---

## 2. HARD CONSTRAINTS — DO NOT VIOLATE

| Constraint | Detail |
|---|---|
| ⚠️ **Never commit unprompted** | The repository is live, but **no commit or push happens without the lead asking for it.** Propose the plan, wait for approval, then execute. This gate does not expire. |
| 📦 **Published, private** | Remote is `patelsahil2k03/innovatrix-645-odoo-hackathon-2026-finale`, **private**. Published in stages — never one bulk commit. |
| 🌿 **`main` and `dev` only** | Feature branches get created as work appears and are named after the work, **never after a person**. No role-based branch assignment — this was explicitly rejected. |
| 🚫 **No AI trailers in commits** | `ai_guidelines/UNIVERSAL_GIT_RULES.md` §2 forbids `Co-Authored-By`, `Signed-off-by` and any assistant attribution. This overrides any tool default. |
| 🚫 **No timeline-driven reasoning** | Do not justify decisions by hours remaining or schedule pressure. The playbook contains a timeline; it is the team's, not a lever for AI decisions. |
| 🚫 **Nothing third-party vendored** | `.claude/` is gitignored. Skills are installed per-developer — see `11_AI_TOOLING.md` §2. |
| 🚫 **Don't over-lock the stack** | The DB is a one-variable switch, Docker is optional. |
| ✅ **Follow `ai_guidelines/`** | Three rulebooks: AI rules, cleanup/reorg rules, git rules. They govern approval gates, safe deletion, commit format. |

---

## 3. DECISIONS MADE, AND WHY

**Stack kept from the virtual round** (FastAPI + Next.js) — the team has shipped with it.
Versions were re-verified live against npm/PyPI rather than inherited.

**Three dependency landmines found and handled:** `passlib` is dead (breaks against modern
`bcrypt`) → we call `bcrypt` directly. TypeScript 7 and ESLint 10 are current but are major
rewrites → pinned `^5` and `^9`. `sse-starlette` jumped 2.x → 3.x → pinned `~=3.4`.

**Database: Postgres for anything graded, SQLite fine locally.** The reason is *not* the
one usually given — see [`01_STACK.md`](01_STACK.md) §3.1, which records the actual test
output. Money on SQLite is exact; the real problem is that `with_for_update()` compiles to
a plain `SELECT` on SQLite, silently disabling `lock_row()`.

**Two new dependencies, both demanded by the mockup rather than chosen: `weasyprint` and
`aiosmtplib`.** An earlier pass concluded PDF and email were out of scope — the mockup draws
Print, Send and a PDF-download action, so both were reversed. Email is real SMTP, which
cuts against the organizers' offline guidance; it is deliberately kept off the demo path and
never allowed to block a state change — see [`01_STACK.md`](01_STACK.md) §3.2. Everything
else in the domain is still `Numeric`, `Enum` and `SUM(...) GROUP BY`.

**Docs are tracked, not gitignored** — reversing the previous project's convention, which
caused the dead-link bug in `10_LESSONS.md` §11 and meant teammates couldn't get the
playbook from a clone. The repo is private, so nothing here is public.

**Four role cards were collapsed into one lanes doc** ([`team/LANES.md`](team/LANES.md)).
They assigned branches to people, which contradicts the branch decision above, and
duplicated the merge checklist and commit conventions from other docs.

---

## 4. WHAT IS BUILT AND VERIFIED

**Backend — 32 tests passing** (`cd backend && uv run pytest`)
App factory, settings, DB session, error envelope, bcrypt hashing, JWT + shared token
extraction, RBAC dependency factory, pagination/sort/search with allowlists, SSE hub, audit
middleware, CSV export, User/Role/AuditLog/Notification models, health/auth/events/
notifications/audit-log routers, rule-engine helpers (`lock_row`, `require_status`,
`emit`), simulator skeleton, deterministic seed with Indian data generators.

**Frontend — build green** (`cd frontend && npm run build`)
Design system (light+dark, single-variable re-theme, no flash), app shell with sidebar and
live indicator, login page with inline validation, dashboard example, typed API client with
`ApiError`, auth context with route gating, hooks (`useFetch`, `useDebouncedValue`,
`useEventStream`, `usePagedRows`), Zod validation, and nine accessible UI primitives.

**Real-time — verified against a real uvicorn server** (`./scripts/verify-sse.sh`).

> ⚠️ **Known limitation, already investigated — do not re-debug this.** The SSE stream
> **cannot** be tested in-process. `EventSourceResponse` uses anyio task groups that
> neither starlette's `TestClient` nor `httpx.ASGITransport` can drive; both hang. This is
> a harness limitation, not a bug. The hub's logic is unit-tested; the wire format is
> verified by the script. Don't chase it again.

**Also found and fixed:** Next.js 16 removed the `eslint` key from `next.config.ts`
(and `next lint`); leaving it in is a hard build error.

---

## 5. WHAT IS NOT BUILT YET

**The entire accounting domain.** No models, no posting engine, no documents, no reports, no
screens. The design is fully specified — corrected against the mockup, not just the PDF —
and ready to implement:

| What | Where it's specified |
|---|---|
| Schema, eight account types, the budget revision chain, **the four posting rules** | [`03_DATA_MODEL.md`](03_DATA_MODEL.md) |
| Endpoints, sign-up, PDF/email, and the error-code registry | [`04_API_CONTRACT.md`](04_API_CONTRACT.md) |
| The posting engine, budget computation, PDF/email, build order, locking | [`06_BACKEND.md`](06_BACKEND.md) |
| Screens, the four-menu nav, Kanban views, money formatting, the drill-down | [`05_FRONTEND.md`](05_FRONTEND.md) |
| The invariant test suite, including the budget and mail-never-blocks cases | [`07_TESTING_AND_REVIEW.md`](07_TESTING_AND_REVIEW.md) |
| Every place the mockup changed the PDF-only design | [`PROBLEM_STATEMENT.md`](PROBLEM_STATEMENT.md) §4 |
| Why each significant decision was made | [`13_DESIGN_FAQ.md`](13_DESIGN_FAQ.md) |

**Build order is not negotiable:** ledger tables → posting engine → sales chain end to end
→ everything else. See [`06_BACKEND.md`](06_BACKEND.md) §1.

---

## 6. THE ONE RULE THAT DEFINES THIS SYSTEM

> **Documents never store a balance that a report reads.**
> Documents *post* into the ledger. Reports *aggregate* the ledger.

`services/posting.py` is the only module permitted to write `journal_lines`. If a second
write path appears — a router, the simulator, the seed script — the guarantee is gone and
the differentiator with it.

---

## 7. WORKING STYLE THAT'S BEEN ESTABLISHED

- **Recommend and proceed.** Ask only decision-shaping questions, then act. Don't ask for
  approval on every file — but **do** ask before every commit.
- **Push back on over-engineering.** The lead does this, and is usually right.
- **Verify, don't assert.** Run the test, curl the endpoint, read the output. "It should
  work" is not a status. A claim written into a doc gets tested first — the SQLite
  precision claim in §3 was wrong on the first pass and was caught this way.
- **Correct course plainly** when wrong — no lengthy apologies, just fix it and move on.
- Prefer fewer, better files over more files.

---

## 8. WHERE THINGS ARE

```
innovatrix-odoo-hackathon-2026-finale/
├── ai_guidelines/     3 rulebooks (AI · cleanup · git)
├── docs/              00 playbook → 13 design FAQ, + PROBLEM_STATEMENT
│   ├── team/          LANES.md — four lanes, reference only
│   ├── technicals/    system design, data model, UI system, screen blueprints
│   └── full_flow/     the official Excalidraw mockup
├── backend/           FastAPI, 32 tests passing
├── frontend/          Next.js, build green
├── infra/             Postgres compose
└── scripts/           dev.sh · demo-reset.sh · verify-sse.sh
```

AI skills are **not** vendored — `.claude/` is gitignored. Each person installs their own;
the short list and install commands are in [`11_AI_TOOLING.md`](11_AI_TOOLING.md).

---

## 9. PARKED WORK — the sibling project

`../innovatrix-odoo-hackathon-2026/` (TransitOps, the qualifying entry) has **an audit
completed and a 14-task fix plan written, with zero tasks executed.**

- Branch `fix/production-readiness` exists and is pushed; `main` is untouched
- Plan: `docs/superpowers/plans/2026-08-13-transitops-production-readiness.md`
- Agreed approach: one commit per task, each approved individually
- **Out of scope by explicit instruction:** no branch deletion, no history rewriting, and
  credential/security items are **documented, not fixed**
- Two critical items lead the plan: a seed script broken by a lost `def main():`, and an
  unlocked row in a state transition

That work resumes **after** the finale.
