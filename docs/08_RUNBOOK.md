# 08 — RUNBOOK

> **Read when:** something won't start. Commands only — the reasoning behind the
> single-shared-database setup, password rotation, wifi isolation, and how to confirm a
> teammate's write actually landed is in [`01_STACK.md`](01_STACK.md) §3.2.

---

## 1. HOST MACHINE (starts Postgres — one person, whoever's machine holds the data)

```bash
cp .env.example .env                                   # skip if .env already exists
docker compose -f infra/docker-compose.yml up -d db
grep '^NEXT_PUBLIC_' .env > frontend/.env.local

cd backend
uv sync --extra postgres
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload --port 8000

# second terminal, from the repo root
cd frontend
npm install
npm run dev
```
Or, one command: `./scripts/dev.sh --db docker`

```bash
hostname -I | awk '{print $1}'   # the IP to give teammates
```

| What | Where |
|---|---|
| Web app | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/api/v1/health |
| Adminer (DB browser) | `docker compose -f infra/docker-compose.yml --profile adminer up -d adminer` → http://localhost:8081 |

Demo logins are printed by the seed script. Default password: `Demo@1234`.

---

## 2. TEAMMATE MACHINE (never starts Postgres — always points at the host)

```bash
cp .env.example .env                                   # skip if .env already exists
```
Edit `.env`: replace the `DATABASE_URL` line's `localhost` with the host's IP —
```
DATABASE_URL=postgresql+psycopg://app:<password>@<host-ip>:5432/app
```
then:
```bash
grep '^NEXT_PUBLIC_' .env > frontend/.env.local

cd backend
uv sync --extra postgres
uv run uvicorn app.main:app --reload --port 8000

# second terminal, from the repo root
cd frontend
npm install
npm run dev
```
Or, one command: `./scripts/dev.sh` (**never** `--db docker` on this machine).

| What | Where |
|---|---|
| Web app | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Adminer (DB browser) | http://`<host-ip>`:8081 |

Demo logins: same as host — `Demo@1234`.

---

## 3. COMMON PROBLEMS

**Port already in use / frontend starts on 3001**
A leftover process is holding the port, and the port change then breaks CORS in
confusing ways.
```bash
fuser -k 3000/tcp 8000/tcp
```
`dev.sh` already does this on start and exit.

**Every screen shows an error state / "CORS error" in the browser console**
Almost always `NEXT_PUBLIC_API_URL` pointing at the wrong port, not an actual CORS
misconfiguration — the backend's `allow_origin_regex` already accepts any origin.
Check `curl localhost:8000/api/v1/health` responds with JSON, then confirm
`frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`
(port **8000**, the API — not `8081`, which is Adminer and has no CORS headers
at all, so pointing at it by mistake looks exactly like a CORS failure in devtools).
Fix it in `.env` at the repo root, then `grep '^NEXT_PUBLIC_' .env > frontend/.env.local`
and restart `npm run dev` (Next inlines this at build/start time, not per-request).

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

---

## 3.1 ACCOUNTING-SPECIFIC PROBLEMS

**`Trial balance` badge is red / the balance sheet doesn't balance**
Something wrote `journal_lines` outside `services/posting.py`. That is the only permitted
write path. Find it:
```bash
grep -rn "JournalLine(" backend/src/app --include="*.py" | grep -v services/posting.py
```
Then check for orphaned or one-sided entries:
```sql
SELECT e.entry_number, SUM(l.debit) AS d, SUM(l.credit) AS c
FROM journal_entries e JOIN journal_lines l ON l.entry_id = e.id
GROUP BY e.entry_number HAVING SUM(l.debit) <> SUM(l.credit);
```

**`MISSING_ACCOUNT_MAPPING` when posting**
The contact has no receivable/payable account, or the product has no income/expense
account. The seed sets these; a hand-created record won't have them. Fix the record — do
**not** add a fallback account in the posting code, or the error stops being informative.

**`ALREADY_POSTED` on a document that looks unposted**
A previous attempt committed the entry but failed afterwards. Check:
```sql
SELECT * FROM journal_entries WHERE source_id = '<document-uuid>';
```
If a live entry exists, the document is genuinely posted — refresh the UI.

**A payment is rejected**
`amount` may not exceed the document's remaining balance (`total - amount_paid`), and the
journal must be a `BANK` or `CASH` journal. Both are enveloped 4xx
(`OVERALLOCATED_PAYMENT`, `INVALID_JOURNAL_TYPE`), never a 500. A payment smaller than the
balance is valid — the document simply moves to `PARTIAL`.

**Reports are empty but documents exist**
The documents are still `DRAFT`. Only `POSTED` entries reach a report — that is correct
behaviour, not a bug.

**Frontend build fails on a Next config key**
Next.js 16 removed the `eslint` key from `next.config.ts` (and `next lint`). Lint is a
separate step: `npm run lint`.

---

## 4. BEFORE THE DEMO

```bash
./scripts/demo-reset.sh --yes    # clean, deterministic data
# set SIMULATOR_ENABLED=true in .env so the dashboard visibly moves
./scripts/dev.sh
```
Then walk the full demo path once, in the browser, before recording.

---

## 5. RESET EVERYTHING

```bash
rm -rf backend/.venv backend/app.db frontend/node_modules frontend/.next
./scripts/dev.sh
```
