# Platform layer + full domain schema — verified

### What
`backend/` and `frontend/` scaffolds exist (merged from `dev`) and genuinely work. On top of
the platform layer, **the entire domain schema is already migrated** — every model for
masters, ledger, documents, payments and budgets exists, registered in one Alembic migration
that creates all 24 tables from `docs/03_DATA_MODEL.md`.

### Why / how
Schema before engine, per `docs/06_BACKEND.md` §1's build order. Someone drafted every
SQLAlchemy model and one migration ahead of writing the business-logic layer.

### Verified (commands run, not copied from a doc)
- `cd backend && uv run pytest` → **32 passed**, 0 failed
- `cd frontend && npm install && npm run build` → compiles clean, 3 static routes
  (`/`, `/_not-found`, `/login`)
- `backend/src/app/models/__init__.py` imports all 24 domain + platform models
- `alembic/versions/e41cfb42b8b1_add_accounting_core.py` creates all 24 tables, and the
  constraints match the spec closely, including the subtle ones:
  - `journal_lines`: all 3 CHECK constraints (`nonneg`, `one_sided`, `not_empty`)
  - `journal_entries`: **partial unique index** `uq_journal_entries_source_live` on
    `(source_type, source_id) WHERE state != 'REVERSED'` — both `sqlite_where` and
    `postgresql_where` set, exactly the double-posting guard `docs/03_DATA_MODEL.md` §3 calls
    for
  - `payments`: `amount > 0`, `(invoice_id IS NULL) <> (bill_id IS NULL)`, unique
    `idempotency_key`
  - `budgets`: `period_end > period_start`; `users`: `login_id` 6–12 chars
  - Every document-line table: `quantity > 0`, `unit_price >= 0`, `tax_pct` 0–100
- `seed/seed.py` has `seed_chart_of_accounts` and `seed_journals` functions (not yet run
  against a live demo DB in this check)

### Touches
`backend/src/app/models/*`, `backend/alembic/versions/e41cfb42b8b1_*`, `frontend/src/**`

### Still open — do not mark these done
- `backend/src/app/services/posting.py` does not exist. `post_entry()` / `reverse_entry()`
  are not written. This is the single most important remaining file — see `RULES.md` §3.
- `backend/src/app/routers/domain.py` is still the generic boilerplate placeholder. No
  masters / documents / payments / ledger / reports / portal routers exist.
- `backend/src/app/schemas/` has only `auth.py` + `common.py` — zero domain Pydantic schemas.
- No ledger-invariant tests yet (`docs/07_TESTING_AND_REVIEW.md` §1.1).
- `services/payments.py`, `services/budgets.py`, `services/reports.py`, `services/mail.py`
  don't exist yet either.
- `frontend/src/app/login/page.tsx` still shows placeholder demo accounts
  (Administrator/Manager/Operator/Viewer), not the real roles (Admin/Accountant/User).
- No domain screens on the frontend yet — only `/` and `/login`.
