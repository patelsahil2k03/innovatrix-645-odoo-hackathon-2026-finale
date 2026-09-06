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
uv run pytest                 # 94 tests
uv run pytest -q --no-header  # quieter

uv run pytest tests/test_accounting_flow.py   # the two golden paths + reports
uv run pytest tests/test_business_rules.py    # every "must"/"cannot" in the PS
```

`test_business_rules.py` pairs a **rejecting** and an **accepting** test for each
rule. A rejecting test alone cannot tell a correct guard from an endpoint that
refuses everything — the pair is the claim.

Real-time can't be driven by an in-process test client (see `tests/test_events.py`),
so verify it against a real server:

```bash
../scripts/verify-sse.sh
```

## Layout

```
src/app/
├── main.py       app factory, lifespan, router registration
├── core/         settings · database · errors · security · rbac · pagination
│                 events (SSE hub) · audit middleware · csv export
├── models/       base + mixins · auth · system
│                 masters · documents · ledger · payments · budgets
├── schemas/      common (Page/ORMModel/Money) · auth · masters · documents
│                 payments · budgets · ledger · reports
├── routers/      health · auth · events · notifications · audit_logs
│                 masters · sales · purchases · payments · budgets
│                 ledger · reports · portal · output (print/PDF/send)
├── services/     posting.py   ★ the only code that writes journal lines
│                 documents.py  the two chains and their transitions
│                 payments.py · budgets.py · reports.py · numbering.py
│                 money.py      the one implementation of the tax rule
│                 mail.py · rendering.py · notify.py · rules.py · simulator.py
├── templates/    one document template, one report template (print AND PDF)
└── seed/         deterministic demo data — domain.py builds a month of trading
```

**Read `services/posting.py` first.** Every document that posts calls
`post_entry`, and nothing else may insert into `journal_lines`. The rest of the
system is CRUD around it.

## Conventions

- **Business rules live in `services/`**, never in a router — the API and the
  background task must enforce identical rules through one code path.
- **Lock the row you mutate, then re-check its state** before mutating. `rules.py`
  provides `lock_row` / `require_status`; the reasoning is in its docstring.
- **Errors** use `AppError(code, message, fields=...)`. Invalid input never 500s.
- **Lists** go through `paginate(...)` with allowlisted sortable/searchable columns.
- **Publish SSE events after commit**, never before.
- **UTC everywhere** — `datetime.now(UTC)`, never local `date.today()`.
- **Reports aggregate `journal_lines`**, never `SUM(total)` over a document
  table — and they count entries in state `POSTED` **or** `REVERSED`, because a
  reversal cancels an entry rather than deleting it. See `LEDGER_STATES` in
  `services/posting.py`.
- **Tax is computed per line, rounded per line, then summed** — one
  implementation, `services/money.py`, used by the services and the schemas
  alike.

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

## PDF and email

PDFs render through `xhtml2pdf` (pure Python, no native dependencies) from the
same Jinja templates the `/print` views use. `services/rendering.py` tries
WeasyPrint first, so a host that has its GTK libraries gets the better renderer
with no code change — see `docs/01_STACK.md` §3 for why it is not a dependency.

Email is off until `SMTP_HOST` is set; `POST /{doc}/{id}/send` then returns
`MAIL_NOT_CONFIGURED` rather than silently doing nothing. A send failure is
recorded on the document and never rolls back a posting.
