# 08 — RUNBOOK

> **Read when:** something won't start. Commands only — the reasoning behind the
> single-shared-database setup, password rotation, wifi isolation, and how to confirm a
> teammate's write actually landed is in [`01_STACK.md`](01_STACK.md) §3.2.

---

## 1. THE SETUP IN ONE LINE

**One shared database. Everyone runs their own frontend and backend.** You always
see your own code changes immediately, and everyone shares the same data.
Nothing about the API needs configuring — the web app calls `/api` on whatever
address you opened it at, and that is proxied to your own backend.

---

## 2. START IT

### 2.1 Database — ONE person, once (everyone else skips this)

```bash
docker compose -f infra/docker-compose.yml up -d db
hostname -I | awk '{print $1}'      # share this IP with the team
```

### 2.2 Everyone — including whoever ran 2.1

```bash
cp .env.example .env                # skip if you already have .env
```
Set one line in `.env` — the database host's IP (that person uses `localhost`):
```
DATABASE_URL=postgresql+psycopg://app:<password>@<db-host-ip>:5432/app
```
```bash
cd backend
uv sync --extra postgres
uv run python -m app.seed           # safe: does nothing if data already exists
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# second terminal, from the repo root
cd frontend
npm install
npm run dev
```
Open **http://localhost:3000**. Logins: `admin@urbanfurniture.in` /
`accountant@urbanfurniture.in` / `portal@urbanfurniture.in`, password `Demo@1234`.

Or, one command instead of both terminals: `./scripts/dev.sh`

| What | Where |
|---|---|
| Web app | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Adminer (DB browser) | http://`<db-host-ip>`:8081 |
| Who changed what | `/audit-logs` in the app (Admin login) |

### 2.3 Showing your work to the team

Others open **http://`<your-ip>`:3000** — they get *your* running code against the
shared data. Nothing for them to install.

---

## 2.4 SCHEMA CHANGES AND RESEEDING — read before running either

- `uv run alembic upgrade head` — run by **one** person, whoever changed the schema.
- `uv run python -m app.seed` — safe for anyone, any number of times. It skips
  anything that already exists.
- `uv run python -m app.seed --reset` — **destroys everyone's data.** Announce it in
  the group chat first. Never run it because something looked odd.

---

## 3. COMMON PROBLEMS

**Port already in use / frontend starts on 3001**
A leftover process is holding the port, and the port change then breaks CORS in
confusing ways.
```bash
fuser -k 3000/tcp 8000/tcp
```
`dev.sh` already does this on start and exit.

**Every screen shows an error state**
Your own backend isn't running — the web app proxies `/api` to `localhost:8000` on
your machine. Check it: `curl localhost:8000/api/v1/health` should return JSON.

**"CORS error" in the browser console**
Means `NEXT_PUBLIC_API_URL` has been set. It should stay **unset** — the app is
same-origin through the proxy and needs no API host. Unset it in `.env`, delete
`frontend/.env.local`, restart `npm run dev`.

**Live "Offline" badge, but the rest of the app works**
Only the SSE stream is affected: it's the one call that can't use the proxy (Next
buffers streaming responses), so it goes direct to port 8000. Confirm 8000 is
reachable from the browser's machine. Everything except live updates works without it.

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
