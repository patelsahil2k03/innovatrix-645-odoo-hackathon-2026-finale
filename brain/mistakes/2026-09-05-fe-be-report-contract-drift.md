# 🔴 FE and BE reports drifted apart — three screens were broken

### What happened
Backend routers were built independently from the frontend's API client. Nobody diffed
`frontend/src/lib/api.ts` against the actual Pydantic response models before wiring pages to
them. Result, found only by an explicit FE/BE endpoint audit:

- **Balance Sheet page crashed on load.** Backend returned `assets`/`liabilities` as
  **arrays** of one section per account type, with no `equity` field at all (Capital was
  folded into the `liabilities` array). The FE page expected each to be a single flat group
  and read `data.equity` directly. `docs/04_API_CONTRACT.md` §3.8 only ever said "Assets,
  Liabilities, Equity — grouped" in prose — no JSON example existed to catch the drift, and
  `tsc` can't catch it either since the FE's own `interface` just asserted the shape it
  wanted, not what the server actually sent.
- **P&L page crashed on load.** Backend field names `expenses`/`other_expenses` (plural),
  FE read `data.expense`/`data.other_expense` (singular).
- **Budget Report page silently rendered garbage.** Backend sends `lines` with
  `committed_amount`/`achieved_amount`/`achieved_pct`/`amount_to_achieve`; FE read `rows`
  with `planned`/`actual`/`variance` — completely different names, `Math.abs(undefined)` →
  `NaN` rather than a crash, so this one would have reached a demo un-noticed.
- **Dashboard KPI tiles always showed 0.** A hook duplicated receivables/payables/cash math
  client-side against the (wrong) balance-sheet shape, instead of calling
  `GET /reports/kpis` — an endpoint the backend had already built for exactly this reason,
  that `api.ts` simply never exposed. Also a rule 8 violation (business-meaning calculation
  living in a hook body's `sumByCode`, not fatal on its own, but compounding the shape bug).

### Why this happened
No step in the build ever diffed the FE API client against the BE routers/schemas as a
whole — each side was written to its own idea of the shape, and the API contract doc's
report section was prose-level, not exact JSON, so there was nothing machine-checkable to
catch it. `tsc`/`npm run build` pass clean either way — the interface's promise and the
runtime payload are two different things and only one of them is checked automatically.

### Fix
- `backend/src/app/services/reports.py::balance_sheet()` now returns `assets`/
  `liabilities`/`equity` as three flat `ReportSection`s (merged across account type),
  retained earnings folded in as a synthetic row inside `equity` so its own total is what
  balances against `total_assets` — no client-side addition needed. `schemas/reports.py`,
  the CSV export and the PDF renderer (`routers/output.py`) updated to match.
- FE `api.ts`: `ProfitAndLossReport.expenses`/`other_expenses` renamed to match; `BudgetReport`
  renamed `rows`→`lines`, fields renamed to `committed_amount`/`achieved_amount`/
  `achieved_pct`/`amount_to_achieve`; added `api.reports.kpis()` wired to the existing
  `/reports/kpis` endpoint. `frontend/src/lib/use-dashboard-kpis.ts` rewritten to just call
  it — no more client-side account-code math.
- `docs/04_API_CONTRACT.md` §3.8 now has concrete JSON examples for balance-sheet, P&L and
  budget report (previously only trial-balance had one) — the actual gap that let this
  happen.

### Guard against recurrence
Before wiring a new FE page to a report/endpoint, or after adding/changing a backend
router, actually read the Pydantic response model next to `api.ts`'s matching interface —
don't trust that a `tsc`/`npm run build` pass means the shapes agree; it only checks the FE
type against itself, never against what the server returns. `docs/04_API_CONTRACT.md`
should carry a JSON example for every non-trivial response, not just some — prose ("Assets,
Liabilities, Equity — grouped") is not a contract a diff can be run against.

### Verified
- `cd backend && uv run pytest` → 94 passed
- `cd frontend && npm run build` → compiles clean, all report routes present
