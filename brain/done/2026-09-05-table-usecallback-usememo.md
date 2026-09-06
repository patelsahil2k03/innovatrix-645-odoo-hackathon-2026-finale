### What
Applied `useCallback`/`useMemo`/`React.memo` across every table/list surface in the
frontend, per explicit request ("on all tables ... use callbacks and use memo for
handling ui").

### Why / how
Two patterns, applied only where they actually buy something (no memoization added where
rows are trivial `<tr>` of a `<Link>` + plain fields and the underlying array changes on
every fetch anyway):

- **Row-level `React.memo` + `useCallback`**, where a parent's update function only
  replaces the *edited* array element's reference (others keep identity) — this makes
  memoization a real win, not cosmetic:
  - `components/ui/line-items-editor.tsx` — extracted `LineItemRow`, memoized; product/
    analytic-account lookups moved from per-row `.find()` to a `useMemo`'d `Map` in the
    parent.
  - `app/account/budgets/new/page.tsx` — extracted `BudgetLineRow`, memoized;
    `updateLine`/`removeLine`/`addLine` wrapped in `useCallback`.
  - `app/reports/budget/page.tsx` — extracted `BudgetReportRowView`, memoized.
  - `app/reports/{balance-sheet,profit-and-loss}/page.tsx` — existing module-scoped
    `GroupTable` wrapped in `React.memo`.
- **`useCallback` on search/field handlers + `useMemo` on values used more than once per
  render**, across every list page (contacts, products, analyticals, budgets,
  chart-of-accounts, journals, journal-entries, sales orders/invoices/receipts, purchase
  orders/bills/payments, audit-log, budget detail). The four pages with a list/Kanban view
  toggle (contacts, products, analyticals, budgets) previously ran `pageData.items.map(...)`
  twice per render (once for the table, once for `KanbanGrid`) — each now computes a single
  `useMemo`'d array in the component body, reused by both. `budgets/page.tsx` additionally
  had `aggregateBudgetLines()` called twice per row; now computed once via
  `rowsWithAggregate = useMemo(...)`.
- Deliberately left untouched: pages with no search box and single-use plain-link rows
  (`portal/documents/page.tsx`, `portal/documents/[id]/page.tsx`,
  `budgets/[id]/lines/[lineId]/documents/page.tsx`, the dashboard) — nothing to memoize
  there, and `setPage`/`setSort` (`useState` setters) were left as direct props everywhere
  since they're already referentially stable.

One derived-array computation was corrected to live in the component body via `useMemo`
rather than inside an `AsyncState` render-prop callback — calling hooks inside a nested
render-prop function risks violating the Rules of Hooks even though it runs synchronously
during render.

### Verified
`npx tsc --noEmit`, `npm run lint` (zero errors/warnings after fixing two: a stale
`budget.reload` dependency — corrected to a destructured `reloadBudget` since eslint can't
see that `useFetch`'s `reload` is itself `useCallback`-stable; an unused `pageData` render-prop
param), and `npm run build` — all 46 routes compile and prerender successfully.

### Touches
`frontend/src/components/ui/line-items-editor.tsx`,
`frontend/src/app/reports/{balance-sheet,profit-and-loss,budget}/page.tsx`,
`frontend/src/app/account/budgets/{new,page,[id]}.tsx`,
`frontend/src/app/account/{contacts,products,analyticals}/page.tsx`,
`frontend/src/app/account/{chart-of-accounts,journals,journal-entries}/page.tsx`,
`frontend/src/app/{sales,purchase}/**/page.tsx` (list pages only), `frontend/src/app/audit-log/page.tsx`.

Note: a large, unrelated concurrent change (adding `Breadcrumbs` + `Skeleton` loading
states across most detail/new pages, plus a `next.config.ts` API rewrite proxy) landed in
the same working tree while this work was in progress — visible in `git status` alongside
these changes but not authored as part of this task. Confirmed via `git diff` on a sample
of overlapping files that the two change sets don't collide.
