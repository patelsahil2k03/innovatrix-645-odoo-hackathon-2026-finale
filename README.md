# Innovatrix — Odoo Hackathon 2026 (Final Round)

[![Team](https://img.shields.io/badge/Team-Innovatrix%20%23645-0b6bcb?style=for-the-badge)](#team)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

Team Innovatrix's entry for the Odoo Hackathon 2026 **final round** — a 24-hour on-site
build at Odoo India, Gandhinagar, against a problem statement released on the day.

A working double-entry accounting system for a furniture business, built on a
production-shaped foundation: authentication, role-based access control, a single error
contract, pagination, real-time updates, an audit trail and an accessible design system.

The guarantee the whole design turns on: **a document never stores a balance that a report
reads.** Documents post; reports aggregate. Every figure on every screen is a live query
against the ledger, and the trial balance is asserted on every posting.

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
| Database | SQLAlchemy 2.0 · Alembic migrations · PostgreSQL 18 in Docker by default, SQLite by one variable |
| Charts | Recharts — themed through CSS custom properties, so light and dark cost no JavaScript |
| Auth | JWT in an httpOnly cookie, with role-based access control enforced server-side |

Version pins and the dependency landmines we verified against the live registries are
in [`docs/01_STACK.md`](docs/01_STACK.md).

## What's Built

**Every mandatory deliverable is complete**, with the evidence for each one listed in
[`docs/PROBLEM_STATEMENT.md`](docs/PROBLEM_STATEMENT.md) §2.

### The accounting system

| | |
|---|---|
| **Master data** | Contacts, products (with categories), chart of accounts across 8 account types, journals, journal entries — list and kanban views, created and edited in place |
| **Purchase cycle** | Purchase Order → confirm → Vendor Bill → post → Payment, or a bill raised with no order behind it |
| **Sales cycle** | Sales Order → confirm → Customer Invoice → post → Payment, with tax computed per line by the server and never taken from the request |
| **The ledger** | Every posted document emits one immutable, balanced journal entry. `services/posting.py` is the only writer of `journal_lines`, anywhere |
| **Reports** | Balance Sheet (with a live trial-balance badge), Profit & Loss, Budget Report — every figure aggregated from journal lines, never summed off a document |
| **Analytics** | Income and expense trend, net profit, revenue by analytic account, receivables/payables ageing, top customers and vendors — with switchable chart types |
| **Analytic accounting** | Analytic accounts and budgets with a `DRAFT → CONFIRMED → REVISED → CANCELLED` state machine and a linked revision chain |
| **Customer portal** | A contact signs in, sees only their own invoices and bills, and pays them |
| **Drill-down** | A report figure opens the accounts behind it, then the entries, then the source document |
| **Documents out** | Print view, PDF download and email for invoices and bills; PDF for the P&L |

### The platform underneath

| | |
|---|---|
| **Auth** | JWT in an httpOnly cookie (plus bearer tokens for curl and Swagger), bcrypt hashing |
| **RBAC** | `require_roles(...)` dependency — reads open to staff, writes gated, portal users scoped to their own records |
| **Errors** | One envelope everywhere: `{error: {code, message, fields}}` — bad input never returns a 500 |
| **Lists** | `page` / `page_size` / `sort` / `q` on every endpoint, with allowlisted columns |
| **Real-time** | Server-Sent Events — a posting updates every open screen without a reload |
| **Audit trail** | Every write attempt recorded with actor, action and outcome — refusals included, because "who was told no" is what an audit log is consulted for |
| **Concurrency** | Row-level locking with a re-check after the lock, so two people posting the same document produce one entry |
| **Seed** | Deterministic demo data — twelve months of weighted trading, budgets derived from actuals, and an audit history to match |
| **Design system** | Light and dark from one accent variable, no flash on load; charts theme themselves through CSS custom properties with no JavaScript |
| **UI components** | Drawer, Modal (focus trap, Escape, dialog role), Field (full ARIA wiring), Tabs (roving tabindex), SortableTh (`aria-sort`), Pagination, AsyncState, SearchInput, StatusBadge, StatusChips, KpiGrid, ChartCard, KanbanGrid, TAccountPreview, PageHeading |

### Verified, not asserted

| Check | Result |
|---|---|
| Backend tests | 103 passing |
| Types · lint · production build | clean |
| Ledger | balanced; no unbalanced entry, no one-sided line, no future-dated posting |
| Balance sheet | assets = liabilities + retained earnings, exactly |
| Roles | 3 roles × 18 endpoints — every allow and every refusal as intended |
| Screens | all 21 render; no dead internal links |
| Reads | 10–22 ms through the app's own proxy |

**Not built, deliberately:** image upload on contacts and products (the storage decision is
open), advance payments against an order before an invoice exists, and period locking. Each
is recorded with its reasoning rather than left as a silent gap —
[`docs/PROBLEM_STATEMENT.md`](docs/PROBLEM_STATEMENT.md) §2.

## Getting Started

### Prerequisites

- Node.js ≥ 20
- [uv](https://docs.astral.sh/uv/) ≥ 0.9 (installs Python 3.13 for you)
- Docker — for PostgreSQL, which is the default. SQLite needs none, see below

### Quick start

```bash
git clone https://github.com/patelsahil2k03/innovatrix-645-odoo-hackathon-2026-finale.git
cd innovatrix-645-odoo-hackathon-2026-finale
cp .env.example .env          # then set a real password and JWT secret
./scripts/dev.sh
```

That brings up the database, the API on **:8000** and the web app on **:3000**, and seeds
demo data on first run. `Ctrl+C` stops everything it started.

Step-by-step commands, including how a teammate points their own frontend and backend at
one shared database, are in [`docs/08_RUNBOOK.md`](docs/08_RUNBOOK.md).

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

### Working offline, without Docker

One line in `.env`, nothing else changes:

```bash
DATABASE_URL=sqlite:///./app.db
```

Fine for solo local work. Not for the shared instance, and not for judging concurrency:
SQLite silently ignores `SELECT ... FOR UPDATE`, so the row locking that makes two
simultaneous postings safe is not exercised at all.

### Troubleshooting

Common failures — ports held by a previous run, 401s on every request, an empty
database, real-time not updating — are covered in
[`docs/08_RUNBOOK.md`](docs/08_RUNBOOK.md).

## Commands

```bash
./scripts/dev.sh                    # database + API + web app, seeded on first run
./scripts/dev.sh --db docker        # force the Docker database
./scripts/kill-ports.sh             # free 3000 / 8000 after a crashed run
./scripts/demo-reset.sh             # ⚠️ wipe + reseed demo data
./scripts/verify-sse.sh             # prove real-time works end to end
./scripts/clean-cache.sh            # drop build caches

cd backend  && uv run pytest        # backend tests — 103, all green
cd backend  && uv run python -m app.seed          # top up demo data (safe to re-run)
cd backend  && uv run python -m app.seed --reset  # ⚠️ destructive, prompts first
cd frontend && npm ci               # install exactly the lockfile (use over `npm i`)
cd frontend && npm run build        # production build (must stay green)
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
