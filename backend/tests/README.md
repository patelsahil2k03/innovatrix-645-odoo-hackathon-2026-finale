# Test plan

Scope of this delivery: **schema + test design only**, per the build order in
[`../../docs/06_BACKEND.md`](../../docs/06_BACKEND.md) §1 (steps 1–2 before step 3).
No routers, no services — those are the next slice.

Run it:

```bash
cd backend
uv sync            # or: python -m venv .venv && .venv/bin/pip install -e ".[dev]"
uv run pytest -q
```

Current result: **17 passed, 33 skipped**. Nothing is red; nothing is faked green.

## Two tiers

### 1. Schema tests — real, passing today

`test_schema_constraints.py` hits nothing but the ORM models + SQLite. Every
CHECK/UNIQUE/partial-index constraint from
[`03_DATA_MODEL.md`](../../docs/03_DATA_MODEL.md) §3/§4/§6 is asserted directly:
one-sided journal lines, the `(source_type, source_id) WHERE state != 'REVERSED'`
double-posting guard, account/contact/entry-number/idempotency-key uniqueness,
positive-quantity document lines, exactly-one-target payments, budget period
ordering, one budget line per analytic account.

These must stay green forever — a service-layer bug should never be able to
smuggle a bad row past the database.

### 2. Rule-matrix tests — designed, not yet runnable

`test_ledger_invariants.py`, `test_business_rules.py`, `test_budget_rules.py`,
`test_concurrency.py` are written directly against the service interfaces
documented in [`06_BACKEND.md`](../../docs/06_BACKEND.md) (`post_entry`,
`reverse_entry`, `documents.*`, `payments.pay`, `budgets.revise`) and the
router surface in [`04_API_CONTRACT.md`](../../docs/04_API_CONTRACT.md). None
of those modules exist yet, so every test in these files is collected and
skipped via `pytest.importorskip(..., reason="pending: ...")` — never a bare
`ImportError`, never silently omitted.

**To activate a test:** implement the module it names in its skip reason.
Nothing in the test needs to change — the skip just stops firing and the
test runs for real, pass or fail, against the interface it already assumed.

## Rule → test file map

| # | Rule (docs/PROBLEM_STATEMENT.md §2) | Test file | Tier |
|---|---|---|---|
| 1 | Entry must balance | `test_ledger_invariants.py` | designed (`posting.post_entry`) |
| 2 | Line is one-sided | `test_schema_constraints.py` | **passing** |
| 3 | Posted entry immutable | `test_business_rules.py` | designed (`posting`) |
| 4 | Posting is never manual | — (structural: no direct-create endpoint to test against) | n/a |
| 5 | Reports aggregate ledger only | `test_ledger_invariants.py` (`test_reports_never_read_document_tables`) | designed (`reports`, `documents`) |
| 6 | Payment ≤ remaining balance | `test_business_rules.py` | designed (`payments`) |
| 7 | No double posting | `test_schema_constraints.py` (DB guard) + `test_business_rules.py` (service response) + `test_concurrency.py` (race) | mixed — DB guard **passing** |
| 8 | Archived account rejects posting | `test_business_rules.py` | designed (`posting`) |
| 9 | Contact sees only own docs (404) | `test_business_rules.py` | designed (`app.main` + portal router) |
| 10 | Accountant cannot modify masters | `test_business_rules.py` | designed (`app.main` + RBAC) |
| 11 | PO→Bill copies lines faithfully | `test_business_rules.py` | designed (`documents`) |
| 12 | Tax computed server-side | `test_business_rules.py` | designed (`documents`) |
| 13 | No zero-line documents | `test_business_rules.py` | designed (`documents`) |
| 14 | Paid document cannot be cancelled | `test_business_rules.py` | designed (`documents`, `payments`) |
| 15 | Tax rounded per-line, then summed | — (covered implicitly wherever line tax is asserted; no dedicated rounding-drift test yet) | designed |
| 16 | Tax rate/account is a snapshot | `test_business_rules.py` | designed (`documents`) |
| 17 | Archiving doesn't rewrite history | `test_business_rules.py` | designed (`documents`) |
| — | Budget achieved/pct/to_achieve, revision chain | `test_budget_rules.py` | designed (`budgets`) |
| — | Sign-up credential rules | `test_business_rules.py` | designed (`app.main` + auth router) |
| — | Mail never blocks posting | `test_business_rules.py` | designed (`documents`, `mail`) |

## Fixtures (`conftest.py`)

In-memory SQLite per test, foreign keys on. `chart_of_accounts` seeds the
10-account minimal chart from [`03_DATA_MODEL.md`](../../docs/03_DATA_MODEL.md)
§8. `journals`, `customer`, `vendor`, `product`, `analytic_accounts` build the
smallest fixture graph each test needs. `client` is a FastAPI `TestClient` that
itself skips cleanly until `app/main.py` exists — router-level tests don't need
their own guard.
