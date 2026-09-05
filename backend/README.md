# Backend

FastAPI · SQLAlchemy 2.0 · Alembic · Python 3.13 (via [uv](https://docs.astral.sh/uv/))
SQLite by default; PostgreSQL by changing one environment variable.

## Run

```bash
uv sync                                       # install Python + dependencies
uv run python -m app.seed                     # create tables + demo users
uv run uvicorn app.main:app --reload --port 8000
```

- Swagger: http://localhost:8000/docs
- Health: `GET http://localhost:8000/api/v1/health`

## Tests

```bash
uv run pytest                 # 32 tests: auth, RBAC, pagination, errors, events, seed
uv run pytest -q --no-header  # quieter
```

Real-time can't be driven by an in-process test client (see `tests/test_events.py`),
so verify it against a real server:

```bash
../scripts/verify-sse.sh
```

## Layout

```
src/app/
├── main.py       app factory, lifespan, router registration  ← ★ register yours here
├── core/         settings · database · errors · security · rbac · pagination
│                 events (SSE hub) · audit middleware · csv export
├── models/       base + mixins · auth (User/Role) · system (AuditLog/Notification)
│                 domain.py  ← ★ your tables
├── schemas/      common (Page/ORMModel) · auth · domain.py ← ★ your schemas
├── routers/      health · auth · events · notifications · audit_logs
│                 domain.py  ← ★ your endpoints
├── services/     rules.py  ← ★ your business rules · simulator.py ← ★ live data
└── seed/         deterministic demo data + generators
```

## Conventions

- **Business rules live in `services/`**, never in a router — the API and the
  background task must enforce identical rules through one code path.
- **Lock the row you mutate, then re-check its state** before mutating. `rules.py`
  provides `lock_row` / `require_status`; the reasoning is in its docstring.
- **Errors** use `AppError(code, message, fields=...)`. Invalid input never 500s.
- **Lists** go through `paginate(...)` with allowlisted sortable/searchable columns.
- **Publish SSE events after commit**, never before.
- **UTC everywhere** — `datetime.now(UTC)`, never local `date.today()`.

Adding a resource: `docs/06_BACKEND.md` has the five-file, 15-minute recipe.

## Database

```bash
# SQLite (default)  — DATABASE_URL=sqlite:///./app.db
# PostgreSQL        — DATABASE_URL=postgresql+psycopg://app:app@localhost:5432/app
uv sync --extra postgres      # psycopg is an optional dependency

uv run alembic revision --autogenerate -m "add orders"
uv run alembic upgrade head
uv run alembic check          # models match the latest migration?
```
