/**
 * Turning a stored audit row into something a person can read.
 *
 * The row is deliberately raw — `POST /api/v1/customer-invoices`, a UUID, a
 * status code — because an audit record has to keep what actually happened,
 * not a prettier retelling of it. The translation belongs on the way out, and
 * on the way out means here rather than in the component (brain/RULES.md §8).
 */

import type { AuditLog } from "@/lib/api";

/** Audit `entity_name` is the URL segment the write went to; these are the
 *  screens a reader would want to land on from it. Anything absent has no
 *  list screen, so its row stays plain text rather than a dead link. */
const ENTITY_ROUTES: Record<string, string> = {
  "sales-orders": "/sales/orders",
  "customer-invoices": "/sales/invoices",
  "purchase-orders": "/purchase/orders",
  "vendor-bills": "/purchase/bills",
  payments: "/purchase/payments",
  contacts: "/account/contacts",
  products: "/account/products",
  accounts: "/account/chart-of-accounts",
  journals: "/account/journals",
  "journal-entries": "/account/journal-entries",
  "analytic-accounts": "/account/analyticals",
  budgets: "/account/budgets",
};

const ENTITY_LABELS: Record<string, string> = {
  "sales-orders": "Sales order",
  "customer-invoices": "Customer invoice",
  "purchase-orders": "Purchase order",
  "vendor-bills": "Vendor bill",
  payments: "Payment",
  contacts: "Contact",
  products: "Product",
  accounts: "Account",
  journals: "Journal",
  "journal-entries": "Journal entry",
  "analytic-accounts": "Analytic account",
  budgets: "Budget",
};

/** What the HTTP verb did, in the words a person would use. */
const VERBS: Record<string, string> = {
  POST: "Created",
  PATCH: "Updated",
  PUT: "Replaced",
  DELETE: "Deleted",
};

export function entityLabel(entityName: string): string {
  return ENTITY_LABELS[entityName] ?? entityName;
}

/**
 * The record's own screen, with its drawer open — the same URL the list pages
 * use, so a row in the audit log lands on the thing it describes.
 * `undefined` when there is no id or no screen, which is a plain-text row.
 */
export function auditEntityHref(row: AuditLog): string | undefined {
  const route = ENTITY_ROUTES[row.entity_name];
  if (!route || !row.entity_id) return undefined;
  return `${route}?open=${row.entity_id}`;
}

/**
 * "Created" / "Updated", plus the sub-action when the path carries one:
 * `POST /api/v1/customer-invoices/{id}/post` is a posting, not a creation, and
 * calling both "Created" would misreport what happened.
 */
export function describeAction(action: string): string {
  const [method, path = ""] = action.split(" ");
  const segments = path.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";

  // A trailing word that is not an id is the operation: post, confirm, cancel.
  const isId = last.length >= 32 && last.includes("-");
  if (method === "POST" && last && !isId && segments.length > 3) {
    return last.charAt(0).toUpperCase() + last.slice(1);
  }
  return VERBS[method] ?? method;
}

export function wasAccepted(row: AuditLog): boolean {
  return row.status_code < 400;
}

/** Who did it — name first, then email, and only then the id, which is what
 *  the screen used to show for every row. */
export function actorLabel(row: AuditLog): string {
  return row.user_name ?? row.user_email ?? row.user_id;
}
