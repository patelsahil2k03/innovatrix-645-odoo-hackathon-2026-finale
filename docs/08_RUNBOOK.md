# 08 — RUNBOOK

> **Read when:** something won't start.

---

## 1. FIRST RUN

```bash
cp .env.example .env

cd backend
uv sync --extra postgres           # psycopg — needed for the Postgres path
uv run alembic upgrade head
uv run python -m app.seed          # chart of accounts + demo users + demo ledger
uv run uvicorn app.main:app --reload --port 8000

# in a second terminal
cd frontend
npm install
npm run dev
```

Or everything at once from the repo root:
```bash
./scripts/dev.sh --db docker      # Postgres — use this for anything being graded
./scripts/dev.sh                  # SQLite — fine for local work, see the caveat below
```

> ⚠️ **Which database, and why it matters here.** Money is exact on both — that was tested.
> But `SELECT … FOR UPDATE` is **silently dropped** on SQLite, so `lock_row()` stops locking
> while still looking correct in the source. Use Postgres for the demo, for anything being
> graded, and whenever you're testing concurrency. Full detail and the test output:
> [`01_STACK.md`](01_STACK.md) §3.1.

| What | Where |
|---|---|
| Web app | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/api/v1/health |

Demo logins are printed by the seed script. Default password: `Demo@1234`.

---

## 2. SHARED TEAM DATABASE

One person hosts Postgres; everyone else points their own `.env` at that machine's IP
instead of running a second copy. This is what makes "when I do `docker compose down` the
data shouldn't be lost" true for the whole team, not just for the host.

### 2.1 Host it (one person, once)

**Set a real `POSTGRES_PASSWORD` in `.env` before starting it** — this instance is
reachable by anyone on the same LAN or hotspot, and the `app`/`app` default is fine only
for a throwaway solo instance nobody else connects to.
`openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | cut -c1-22` generates one.

```bash
docker compose -f infra/docker-compose.yml up -d db
docker compose -f infra/docker-compose.yml ps        # wait for "healthy"
hostname -I | awk '{print $1}'                       # the IP to give everyone
```

`down` (bare, no flags) never touches the data — `pgdata` is a named volume, and only
`down -v` / `down --volumes` or `docker volume rm hackathon_pgdata` destroy it. Never run
either of those against a database anyone else is using.

> ⚠️ **Changing `POSTGRES_PASSWORD` in `.env` does nothing on an already-running
> instance** — Postgres only reads it once, when the volume is first initialized. If you
> already started the container with the old password, rotate it on the live instance
> instead: `docker exec hackathon-db psql -U app -d app -c "ALTER USER app WITH PASSWORD
> '<new>';"`, then update `DATABASE_URL` in `.env` to match.
>
> ⚠️ **A `docker exec ... psql` test proves nothing about real remote auth.** The base
> image's `pg_hba.conf` trusts `127.0.0.1`/`::1` unconditionally — connections from
> *inside the container's own network namespace* skip password checking entirely, which
> makes an old, already-rotated password look like it "still works" if you test that way.
> Anything arriving from outside that namespace — the app on the host via `localhost`,
> or a teammate via your LAN IP — hits the real `scram-sha-256` rule and needs the actual
> password. Test from the host or from another machine, never via `docker exec`, if
> you're verifying a password change actually took effect.

### 2.2 Everyone else connects to it

In your **own** `.env`, replace `localhost` with the host's IP:
```bash
DATABASE_URL=postgresql+psycopg://app:app@<host-ip>:5432/app
```
Then run the backend as normal (`uv run uvicorn app.main:app --reload`) — no local Postgres,
no local migration, just point at the shared one.

### 2.3 Test it actually works — before assuming it does

Venue and office wifi sometimes enable **AP client isolation**, which blocks exactly this
kind of device-to-device connection on purpose. Test it the moment everyone's on the same
network, don't wait to discover it's broken mid-build:

```bash
nc -zv <host-ip> 5432                    # Windows: Test-NetConnection <host-ip> -Port 5432
```

- **Connects** → you're done, use the network as-is.
- **"Connection refused"** → the network is fine; check the container is actually healthy
  on the host's side (§2.1), and that the host's own firewall allows it:
  `sudo ufw allow 5432/tcp` (Ubuntu).
- **Times out / hangs** → that's the isolation signature — the packet never arrived. Stop
  debugging Postgres and go straight to the fallback below.

### 2.4 Fallback: a phone hotspot

A phone's hotspot is a NAT you control, and unlike a lot of venue wifi it doesn't isolate
its own clients from each other by default. If §2.3 times out:

1. One person turns on their phone's hotspot (Android: Tethering. iPhone: Personal Hotspot).
2. Everyone — including whoever hosts Postgres — joins **that** hotspot instead of venue wifi.
3. Re-run `hostname -I` on the hosting machine; you'll get a new IP (usually `192.168.x.x`).
   That's the address everyone now uses in step 2.2.

The phone hosting the hotspot doesn't have to be the same person running Postgres.

### 2.5 Migrations — one person runs them, against the shared instance

Everyone's `DATABASE_URL` points at the same database, so **only one person runs
`alembic upgrade head`** — whoever is actively working on the schema, typically on the
backend feature branch. Everyone else only ever reads and writes rows; running a second,
uncoordinated `alembic revision --autogenerate` against a database someone else is also
migrating is how two migration histories diverge. If the schema needs to change, say so in
the group chat first, the same as any other contract change (`04_API_CONTRACT.md` §5).

### 2.6 Looking at the data without a Postgres client

```bash
docker compose -f infra/docker-compose.yml --profile adminer up -d adminer
```
Then open `http://<host-ip>:8081`, system **PostgreSQL**, server `db`, user/password from
`.env` (`app`/`app` by default), database `app`. It isn't started by the plain `up -d db`
command — bring it up explicitly only when someone actually wants to browse the tables.

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
