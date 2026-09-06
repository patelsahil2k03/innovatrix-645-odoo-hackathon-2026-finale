### What
Ran a full frontend UX/accessibility audit (47 routes, global shell, 16 shared UI components,
6 forms — via 3 parallel sub-agents split global/account/sales-purchase-reports-portal) and
fixed the P0 findings: built a reusable `ConfirmDialog` (`components/ui/confirm-dialog.tsx`,
on top of the existing accessible `Modal`) and a toast notification system
(`lib/toast-context.tsx` + `components/ui/toast.tsx`, `useToast()` hook, mounted once via
`ToastProvider` in `app/layout.tsx`), then wired both into every destructive/irreversible
action that previously fired with zero confirmation and zero success feedback:
- Archive on all 5 master-data detail pages: analyticals, chart-of-accounts, contacts,
  journals, products
- Cancel on a **posted** sales invoice / vendor bill (reverses a posted ledger entry with a
  second balancing entry — tone="danger")
- Cancel on a **draft** sales order / purchase order (discards the draft — tone="neutral",
  lower stakes than the posted-document case)

State machine for each (open/pending/error) lives in `lib/use-confirm-action.ts`, not in the
`.tsx` files — matches `RULES.md` §8 (no business logic in components).

### Why / how
Full audit findings (P0–P3) were reported to the user first; user chose "P0 only" scope via
AskUserQuestion before any code was touched. P0 was one root cause with two symptoms: no
success feedback anywhere in the app, and no confirmation primitive despite `Modal` already
being fully accessible (focus trap/Escape/restoration) — so archiving a contact or cancelling
a posted invoice fired instantly with no undo path and no "it worked" signal.

P1–P3 findings were reported but **not implemented** — see the audit summary in this
conversation for the full list (no global `error.tsx`, no skip-to-content link, no status
filters on document lists, audit-log has no filters despite likely being the largest dataset,
etc.). Re-run the same 3-way parallel-fork audit approach if picking these up later; don't
re-derive the inventory from scratch.

### Verified
`npx tsc --noEmit` clean both before and after a concurrent merge (see below). No ESLint
errors introduced (one pre-existing unrelated error in `use-event-stream.ts`, not touched).
Not yet clicked through in a browser.

**Concurrent merge note:** while this was in flight, the user committed the working-tree
changes directly (`d85b75b`, author Gaurav — matches this session's file list exactly) and
merged `dev-feature` (teammate PranjalShah86's `4793ac5`, a `ClosePanel` component solving a
different audit finding — missing back/cancel on create pages) via `af47631`. Merge produced
no conflict markers and `tsc` stayed clean — the two features are complementary, not
overlapping.

### Touches
New: `frontend/src/components/ui/confirm-dialog.tsx`, `frontend/src/components/ui/toast.tsx`,
`frontend/src/lib/toast-context.tsx`, `frontend/src/lib/use-confirm-action.ts`.
Edited: `frontend/src/app/layout.tsx` (mounts `ToastProvider`), `frontend/src/app/design-system.css`
(`.confirm-dialog-*`, `.toast-*` rules), and the 9 pages listed above.
