/**
 * URLs for the ledger drill-down.
 *
 * The journal-entries screen filters on ONE `account_id` and shows a "back to
 * where you came from" crumb built out of `from` / `from_label`, so those four
 * parameters have to agree. Building them in one place keeps every entry point
 * (report figures, dashboard tiles) landing on the same screen in the same
 * state, instead of each page hand-rolling a query string that drifts.
 */

export interface LedgerDrillOptions {
  accountId: string;
  accountLabel: string;
  /** Path to return to. Defaults to the dashboard. */
  from?: string;
  fromLabel?: string;
}

export function ledgerDrillHref({
  accountId,
  accountLabel,
  from = "/",
  fromLabel = "Dashboard",
}: LedgerDrillOptions): string {
  const params = new URLSearchParams({
    account_id: accountId,
    account_label: accountLabel,
    from,
    from_label: fromLabel,
  });
  return `/account/journal-entries?${params.toString()}`;
}

/**
 * Drill target for a dashboard tile backed by control accounts.
 *
 * Returns `undefined` when there is no single account to filter on — either the
 * figure has not loaded yet, or it spans several accounts (cash and bank).
 * `undefined` makes the tile render as plain text rather than a link that would
 * land on an unfiltered ledger and look broken.
 */
export function ledgerHref(
  accountIds: string[],
  label: string,
): string | undefined {
  if (accountIds.length !== 1) return undefined;
  return ledgerDrillHref({ accountId: accountIds[0], accountLabel: label });
}
