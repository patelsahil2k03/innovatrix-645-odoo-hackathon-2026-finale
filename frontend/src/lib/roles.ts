/**
 * Role helpers for the UI.
 *
 * ⚠️ THIS IS NOT A SECURITY BOUNDARY. It exists so the interface doesn't show people
 * buttons that will fail — decluttering, not protection. The real check is the
 * server's `require_roles(...)` dependency, which returns 403 regardless of what the
 * UI renders. Never treat a hidden button as an access control.
 *
 * ★ Rename these to the roles your problem statement actually defines, and keep the
 *   names byte-identical to the backend's seeded role rows.
 */

export const ROLES = {
  ADMIN: "Administrator",
  MANAGER: "Manager",
  OPERATOR: "Operator",
  VIEWER: "Viewer",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

const has = (role: string | undefined, allowed: readonly string[]): boolean =>
  role !== undefined && allowed.includes(role);

/** Write-capability helpers. Mirror one per write-gated backend endpoint group. */
export const can = {
  manageUsers: (role?: string) => has(role, [ROLES.ADMIN]),
  viewAuditLog: (role?: string) => has(role, [ROLES.ADMIN]),
  approve: (role?: string) => has(role, [ROLES.ADMIN, ROLES.MANAGER]),
  write: (role?: string) => has(role, [ROLES.ADMIN, ROLES.MANAGER, ROLES.OPERATOR]),
};

/** Which nav items each role sees. Omit a role to show the item to everyone. */
export const NAV_VISIBILITY: Record<string, readonly string[] | undefined> = {
  "/": undefined,
  "/audit-log": [ROLES.ADMIN],
};

export function canSeeNavItem(href: string, role?: string): boolean {
  const allowed = NAV_VISIBILITY[href];
  return allowed === undefined || has(role, allowed);
}
