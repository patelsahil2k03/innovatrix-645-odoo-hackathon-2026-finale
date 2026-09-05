# 08 — RUNBOOK

> **Read when:** something won't start.

---

## 1. FIRST RUN

```bash
cp .env.example .env

cd backend
uv sync
uv run python -m app.seed          # creates tables + demo users, prints logins
uv run uvicorn app.main:app --reload --port 8000

# in a second terminal
cd frontend
npm install
npm run dev
```

Or everything at once from the repo root:
```bash
./scripts/dev.sh                  # SQLite, no Docker
./scripts/dev.sh --db docker      # also starts Postgres
```

| What | Where |
|---|---|
| Web app | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/api/v1/health |

Demo logins are printed by the seed script. Default password: `Demo@1234`.

---

## 2. COMMON PROBLEMS

**Port already in use / frontend starts on 3001**
A leftover process is holding the port, and the port change then breaks CORS in
confusing ways.
```bash
fuser -k 3000/tcp 8000/tcp
```
`dev.sh` already does this on start and exit.

**Every screen shows an error state**
The API isn't running or isn't reachable. Check `curl localhost:8000/api/v1/health`,
then confirm `NEXT_PUBLIC_API_URL` in `frontend/.env.local` matches the API's port.

**401 on every request even after signing in**
The auth cookie isn't being sent. Check that the frontend origin is in `cors_origins`
(backend settings) and that requests use `credentials: "include"` — `lib/api.ts` does
this already, so suspect a port mismatch first.

**`ModuleNotFoundError: app`**
Run backend commands from `backend/` via `uv run` — `pythonpath = ["src"]` in
`pyproject.toml` is what makes the package importable.

**Database looks empty / stale**
```bash
./scripts/demo-reset.sh          # ⚠️ destructive, prompts first
```

**Migration conflicts or a broken chain**
For a demo, deleting the SQLite file and re-seeding is a legitimate escape hatch:
```bash
rm backend/app.db && cd backend && uv run python -m app.seed
```

**Real-time isn't updating**
```bash
./scripts/verify-sse.sh          # proves the stream end to end
```
Also confirm `SIMULATOR_ENABLED=true` in `.env` if you expect data to move on its own.

**Frontend build fails on a Next config key**
Next.js 16 removed the `eslint` key from `next.config.ts` (and `next lint`). Lint is a
separate step: `npm run lint`.

---

## 3. BEFORE THE DEMO

```bash
./scripts/demo-reset.sh --yes    # clean, deterministic data
# set SIMULATOR_ENABLED=true in .env so the dashboard visibly moves
./scripts/dev.sh
```
Then walk the full demo path once, in the browser, before recording.

---

## 4. RESET EVERYTHING

```bash
rm -rf backend/.venv backend/app.db frontend/node_modules frontend/.next
./scripts/dev.sh
```
