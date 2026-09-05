/**
 * Role helpers for the UI.
 *
 * ⚠️ THIS IS NOT A SECURITY BOUNDARY. It exists so the interface doesn't show people
 * buttons that will fail — decluttering, not protection. The real check is the
 * server's `require_roles(...)` dependency, which returns 403 regardless of what the
 * UI renders. Never treat a hidden button as an access control.
 *
 * Three roles, straight from docs/PROBLEM_STATEMENT.md §2 / 13_DESIGN_FAQ.md Q2:
 * Admin (full rights, including modify/archive master data), Accountant (creates
 * master data and records transactions, cannot modify or archive), User (portal
 * customer — own invoices/bills only). Reads are open to any authenticated internal
 * user (docs/02_ARCHITECTURE.md §6) — only writes are role-gated here.
 */

export const ROLES = {
  ADMIN: "Admin",
  ACCOUNTANT: "Accountant",
  USER: "User",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

const has = (role: string | undefined, allowed: readonly string[]): boolean =>
  role !== undefined && allowed.includes(role);

/** Write-capability helpers — one per write-gated backend endpoint group
 *  (04_API_CONTRACT.md §3.1, §3.2–3.6). */
export const can = {
  /** Create master data, record/post transactions, register payments. */
  record: (role?: string) => has(role, [ROLES.ADMIN, ROLES.ACCOUNTANT]),
  /** Modify or archive master data — Admin only, per the statement's own split. */
  manageMasterData: (role?: string) => has(role, [ROLES.ADMIN]),
  /** Cancelling an already-posted invoice/bill (04_API_CONTRACT.md §3.2) — Admin only. */
  cancelPostedDocument: (role?: string) => has(role, [ROLES.ADMIN]),
  viewAuditLog: (role?: string) => has(role, [ROLES.ADMIN]),
};

/** Which nav items each role sees. Omit a role to show the item to everyone
 *  authenticated internally — the User role never reaches this nav at all, it
 *  gets the separate portal shell (see app/portal/layout.tsx). */
export const NAV_VISIBILITY: Record<string, readonly string[] | undefined> = {
  "/": undefined,
  "/sales/orders": undefined,
  "/sales/invoices": undefined,
  "/sales/receipts": undefined,
  "/purchase/orders": undefined,
  "/purchase/bills": undefined,
  "/purchase/payments": undefined,
  "/account/contacts": undefined,
  "/account/products": undefined,
  "/account/analyticals": undefined,
  "/account/budgets": undefined,
  "/account/chart-of-accounts": undefined,
  "/account/journals": undefined,
  "/account/journal-entries": undefined,
  "/reports/balance-sheet": undefined,
  "/reports/profit-and-loss": undefined,
  "/reports/budget": undefined,
  "/audit-log": [ROLES.ADMIN],
};

export function canSeeNavItem(href: string, role?: string): boolean {
  const allowed = NAV_VISIBILITY[href];
  return allowed === undefined || has(role, allowed);
}
