# CARD B — Backend Core

> **Branch:** `feature/backend` · **Works in:** `backend/` · **Merges:** → `dev` (via Card D review) → `main`
> **Keep open all day:** `../04_API_CONTRACT.md` (you implement it 1:1) and `../06_BACKEND.md`

## Your mission in one line
**Every business rule in the problem statement is enforced server-side, inside a transaction, and provably rejects bad input.**

## ⚠️ You are the bottleneck — protect your time
This round has **one** backend owner where the virtual round had two. That is a deliberate
risk we've accepted, and it means:
- **You stay on the critical path only**: models → auth wiring → the state machine → core CRUD.
- **You delegate aggressively.** Seed data, analytics/report queries, and CSV export are
  parallelizable — hand them to Card C or Card D the moment your core is unblocked. Ask early;
  don't discover at 20:00 that you're three hours behind.
- If someone offers help and you're deep in the rule engine, the answer is *"yes — take the
  seed script."*

## What you own
- SQLAlchemy models + Alembic migration for the PS's domain
- The **state machine / rule engine** (`services/rules.py`) — the most important file you'll write
- All routers per the API contract, with pagination/filter/sort
- Wiring auth + RBAC (the boilerplate already ships these — you configure roles, not build JWT)
- The real-time channel (SSE events published after commit)

## What you do NOT own
- Frontend anything. If a screen is wrong, tell Card A — don't fix it yourself.
- Merging to `dev` — Card D reviews.

## Who blocks you / who you block
- **Blocked by:** nobody. You start first. Models are the repo's foundation.
- **You block:** everyone. **Ship `/health` and the first real resource endpoint fast** so the
  frontend can flip off mocks. Auth is already built — don't rebuild it.

## First three tasks (in this order)
1. **Models + migration** from the domain model agreed at 09:35. Enums, unique constraints,
   CHECK constraints, foreign keys, indexes on the hot query paths.
2. **The state machine.** Almost every Odoo-style PS has one entity moving through statuses with
   rules attached (`draft → active → done`, with guards). Build it in one place, in one
   transaction, with row locks. See `06_BACKEND.md` for the exact pattern — **including the
   locking bug that bit us last round.**
3. **CRUD routers** for the core entities, matching the contract exactly.

## Hard rules
- **Invalid input NEVER returns a 500.** Always an enveloped 4xx: `{error:{code,message,fields}}`.
- Business rules live in `services/`, not in routers and not in the frontend. The frontend
  hiding a button is UX; your server rejecting the request is the actual rule.
- **Lock the row you are about to mutate**, and re-check its status *after* acquiring the lock.
  Not doing this is a real bug we shipped last round — read `../10_LESSONS.md` before you write
  the rule engine.
- Publish SSE events **after** the transaction commits, never before.
- Update `04_API_CONTRACT.md` **before** you change an endpoint, not after.

## Definition of done
Contract 100% implemented · Swagger at `/docs` is clean and demo-able · every business rule in
the PS provably rejects via curl · no endpoint 500s on garbage input.

## Prime your AI assistant with this
> I'm building the FastAPI backend for a [one-line app description] in a 24-hour hackathon.
> Stack: FastAPI + SQLAlchemy 2.0 + Alembic, JWT auth via httpOnly cookie with role-based
> access control, SSE for real-time. Auth/RBAC/pagination/error-envelope are already built in
> the boilerplate — I'm adding domain models and business rules. Hard rules run inside DB
> transactions with `SELECT ... FOR UPDATE` row locks, and I re-check status after acquiring the
> lock. Errors use `{error:{code,message,fields}}` with domain codes. My contract:
> [paste from docs/04_API_CONTRACT.md]. I commit my own code with conventional messages. Build
> [task] with me, and explain anything I couldn't defend to an evaluator.
