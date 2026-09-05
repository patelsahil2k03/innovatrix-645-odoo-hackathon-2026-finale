# Innovatrix — Odoo Hackathon 2026 (Final Round)

[![Team](https://img.shields.io/badge/Team-Innovatrix%20%23645-0b6bcb?style=for-the-badge)](#team)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

Team Innovatrix's entry for the Odoo Hackathon 2026 **final round** — a 24-hour on-site
build at Odoo India, Gandhinagar, against a problem statement released on the day.

This repository starts as a production-shaped foundation: authentication, role-based
access control, a single error contract, pagination, real-time updates, an audit trail
and an accessible design system — all working and tested — so the build time goes into
the actual problem domain rather than into plumbing.

## Table of Contents

- [Team](#team)
- [Problem Statement](#problem-statement)
- [Tech Stack](#tech-stack)
- [What's Built](#whats-built)
- [Getting Started](#getting-started)
- [Commands](#commands)
- [Repository Structure](#repository-structure)
- [Documentation](#documentation)
- [Contribution Workflow](#contribution-workflow)
- [License](#license)

## Team

**Innovatrix — Team #645**

| Name | Role | GitHub |
|---|---|---|
| Sahil Patel | Team Lead | [@patelsahil2k03](https://github.com/patelsahil2k03) |
| Devasya Joshi | Member | [@Devasya-Joshi](https://github.com/Devasya-Joshi) |
| Gaurav Rathva | Member | [@gaurav-digiflux](https://github.com/gaurav-digiflux) |
| Pranjal Shah | Member | [@PranjalShah86](https://github.com/PranjalShah86) |

Four working lanes — frontend, backend, reports and pitch, QA and review — are described in
[`docs/team/LANES.md`](docs/team/LANES.md) as reference. Nobody owns a lane and nobody owns
a branch.

Qualified via the virtual round with [TransitOps](https://github.com/patelsahil2k03/innovatrix-odoo-hackathon-2026),
a fleet-operations platform built in 8 hours.

## Problem Statement

**Urban Furniture — Accounting System.**

A double-entry accounting system for a furniture business: master data (contacts, products,
chart of accounts, journals), the purchase and sales cycles through to payment, and
financial reporting — Balance Sheet, Profit & Loss, and Budget.

The defining rule of the build: **documents do not store balances that reports read.**
Every posted invoice, bill and payment emits one immutable, balanced journal entry, and
every report is an aggregation over the ledger. That is what separates an accounting system
from an invoice list with a balance sheet drawn on top.

Full statement, data model and API contract: [`docs/`](docs/README.md).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS v4 |
| Design | Hand-rolled design tokens — light + dark, re-themed from one variable |
| Validation | Zod on the client, mirroring Pydantic on the server |
| Backend | FastAPI · Python 3.13 (managed by [uv](https://docs.astral.sh/uv/)) · REST + Server-Sent Events |
| Database | SQLAlchemy 2.0 · Alembic migrations · SQLite by default, PostgreSQL by one variable |
| Auth | JWT in an httpOnly cookie, with role-based access control enforced server-side |

Version pins and the dependency landmines we verified against the live registries are
in [`docs/01_STACK.md`](docs/01_STACK.md).

## What's Built

The domain-independent half is complete and tested:

| | |
|---|---|
| **Auth** | JWT in an httpOnly cookie (plus bearer tokens for curl and Swagger), bcrypt hashing |
| **RBAC** | `require_roles(...)` dependency — reads open, writes gated |
| **Errors** | One envelope everywhere: `{error: {code, message, fields}}` — bad input never returns a 500 |
| **Lists** | `page` / `page_size` / `sort` / `q` on any endpoint, with allowlisted columns |
| **Real-time** | Server-Sent Events hub, plus an optional background task that mutates data live |
| **Audit trail** | Every successful write recorded with actor, action and entity |
| **Notifications** | Per-user, scoped so one user cannot read another's |
| **CSV export** | Streaming helper |
| **Seed framework** | Deterministic, realistic Indian demo data — names, cities, coordinates, plates |
| **Design system** | Light and dark, one accent variable to re-theme, no flash on load |
| **UI primitives** | Modal (focus trap, Escape, dialog role), Field (full ARIA wiring), Tabs (roving tabindex), SortableTh (`aria-sort`), Pagination, AsyncState, SearchInput, StatusBadge, KpiGrid |
| **Tests** | Auth, RBAC, pagination, error envelope, event hub and seed integrity |

**Not built yet, by design:** the domain layer. Models, schemas, routers, business rules
and screens are written once the problem statement is known. The files exist with `★`
markers and worked examples showing where each piece goes —
[`docs/06_BACKEND.md`](docs/06_BACKEND.md) has the per-resource recipe.

## Getting Started

### Prerequisites

- Node.js ≥ 20
- [uv](https://docs.astral.sh/uv/) ≥ 0.9 (installs Python 3.13 for you)
- Docker is **optional** — only needed if you switch to PostgreSQL

### Quick start

```bash
git clone https://github.com/patelsahil2k03/innovatrix-645-odoo-hackathon-2026-finale.git
cd innovatrix-645-odoo-hackathon-2026-finale
cp .env.example .env
./scripts/dev.sh
```

That starts the API on **:8000** and the web app on **:3000** using SQLite — no Docker,
no external services, works offline. `Ctrl+C` stops both.

### Running the pieces separately

```bash
# API
cd backend
uv sync
uv run python -m app.seed                       # creates tables + demo users
uv run uvicorn app.main:app --reload --port 8000

# Web app (second terminal)
cd frontend
npm install
npm run dev
```

| What | Where |
|---|---|
| Web app | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/api/v1/health |

Demo logins are printed by the seed script. Default password: `Demo@1234`.

### Switching to PostgreSQL

One line in `.env`, nothing else changes:

```bash
DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app
```

Then `./scripts/dev.sh --db docker` and `uv sync --extra postgres`.

### Troubleshooting

Common failures — ports held by a previous run, 401s on every request, an empty
database, real-time not updating — are covered in
[`docs/08_RUNBOOK.md`](docs/08_RUNBOOK.md).

## Commands

```bash
./scripts/dev.sh                    # run everything (SQLite)
./scripts/dev.sh --db docker        # ...with PostgreSQL instead
./scripts/demo-reset.sh             # ⚠️ wipe + reseed demo data
./scripts/verify-sse.sh             # prove real-time works end to end

cd backend  && uv run pytest        # backend tests
cd frontend && npm run build        # frontend build (must stay green)
cd frontend && npm run lint         # lint — a separate step, Next 16 removed `next lint`
```

## Repository Structure

```
├── CLAUDE.md        Read first by Claude Code — imports brain/RULES.md automatically
├── AGENTS.md        Read first by any other AI tool (Codex, Cursor, Copilot, ...)
├── ai_guidelines/   Working rules for AI-assisted development (read once)
├── brain/           Living project memory — rules, mistakes, pending/done work. Start at brain/README.md
├── docs/            Playbook, problem statement, data model, API contract  ← start here
├── backend/         FastAPI app + tests
├── frontend/        Next.js app
├── infra/           Optional PostgreSQL compose file
└── scripts/         dev.sh · demo-reset.sh · verify-sse.sh
```

Per-app detail: [`backend/README.md`](backend/README.md) · [`frontend/README.md`](frontend/README.md)

## Documentation

Start with the **[playbook](docs/00_PLAYBOOK.md)**, then the
**[problem statement and triage](docs/PROBLEM_STATEMENT.md)**. Full index:
[`docs/README.md`](docs/README.md).

Before writing any code, read [`docs/10_LESSONS.md`](docs/10_LESSONS.md) — real mistakes
found by auditing our virtual-round submission, each one either already fixed here or
turned into a habit.

## Contribution Workflow

`main` stays demo-ready. `dev` is where work integrates. Branch off `dev` for whatever
you're working on, and merge back into `dev` through review.

```
main              stable and demo-ready — only dev merges in here
└── dev           integration — feature branches merge here first
    └── feature/<what-you-are-building>
```

Name the branch after the work, not the person — `feature/orders-api`,
`fix/login-validation`, `docs/api-contract`. Create them as you need them.

**House rules**

- Conventional commits, scoped, no AI trailers — `feat(orders): reject quantity above capacity`
- Push under your own account. Per-member contribution is part of the grading.
- Every feature-branch merge into `dev` is reviewed — see [`docs/07_TESTING_AND_REVIEW.md`](docs/07_TESTING_AND_REVIEW.md)
- The API contract changes **before** the code does, never after
- Never commit a line you could not explain to an evaluator

The full working agreement is in [`docs/00_PLAYBOOK.md`](docs/00_PLAYBOOK.md) §8, and the
git standards this repo follows are in
[`ai_guidelines/UNIVERSAL_GIT_RULES.md`](ai_guidelines/UNIVERSAL_GIT_RULES.md).

## License

Released under the [MIT License](LICENSE).
