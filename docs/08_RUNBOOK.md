# 08 — RUNBOOK

> Commands only. Why it is built this way, shared-database details and
> troubleshooting: [`01_STACK.md`](01_STACK.md) §3.2–3.3.

One shared database. Everyone runs their own backend and frontend.

---

## 1. FIRST TIME

```bash
cp .env.example .env
```

In `.env`, set the database host's IP. **That one person keeps `localhost`;
everyone else puts their IP:**

```
DATABASE_URL=postgresql+psycopg://app:<password>@<db-host-ip>:5432/app
```

Database host only:

```bash
docker compose -f infra/docker-compose.yml up -d db
```

Everyone:

```bash
cd backend
uv sync --extra postgres
uv run alembic upgrade head
uv run python -m app.seed
```

```bash
cd frontend
npm install
```

---

## 2. EVERY TIME

Terminal 1:

```bash
cd backend
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Linux/macOS, both plus the database in one command:

```bash
./scripts/dev.sh
```

| | |
|---|---|
| Web app | http://localhost:3000 |
| Show your work to the team | http://`<your-ip>`:3000 |
| API docs | http://localhost:8000/docs |
| Health check | http://localhost:8000/api/v1/health |
| Adminer | http://`<db-host-ip>`:8081 |
| Who changed what | `/audit-logs` in the app |

Logins — password `Demo@1234`:

```
admin@urbanfurniture.in
accountant@urbanfurniture.in
portal@urbanfurniture.in
```

---

## 3. DATABASE

```bash
docker compose -f infra/docker-compose.yml up -d db      # start
docker compose -f infra/docker-compose.yml ps            # status
docker compose -f infra/docker-compose.yml down          # stop, data kept
docker compose -f infra/docker-compose.yml --profile adminer up -d adminer
```

```bash
docker compose -f infra/docker-compose.yml down -v       # ⚠️ DELETES ALL DATA
```

```bash
cd backend
uv run alembic upgrade head          # one person, after a schema change
uv run python -m app.seed            # safe, any time, any number of times
uv run python -m app.seed --reset    # ⚠️ DESTROYS everyone's data — announce first
```

Your IP, to give teammates:

```bash
hostname -I | awk '{print $1}'       # Linux
ipconfig getifaddr en0               # macOS
ipconfig                             # Windows — IPv4 Address
```

---

## 4. WINDOWS

The `docker compose`, `uv` and `npm` commands above run as-is in PowerShell.

`./scripts/*.sh` need **WSL or Git Bash** — they use `fuser`, `hostname -I` and
`/dev/tcp`. Use the two-terminal commands in §2 instead.

---

## 5. PORTS BUSY

```bash
./scripts/kill-ports.sh              # Linux/macOS
```

```powershell
netstat -ano | findstr ":3000 :8000"  # Windows, then: taskkill /PID <pid> /F
```

---

## 6. BEFORE THE DEMO

```bash
cd backend && uv run python -m app.seed --reset --yes
```

Set `SIMULATOR_ENABLED=true` in `.env`, restart, then walk the full demo path
once in the browser.
