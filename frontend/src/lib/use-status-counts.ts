"use client";

/**
 * Document counts per state, for the mockup's All / Draft / Confirmed strips
 * (PROBLEM_STATEMENT.md §4 item 14).
 *
 * Every decision lives here rather than in a component (brain/RULES.md §8):
 * which states a module shows, in what order, and which label a reader sees.
 * A `.tsx` using this only renders what `chipsFor` returns.
 */

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { api, type StatusCountsModule } from "@/lib/api";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";

/** Where each module's list lives, so a chip can link to it. */
export const MODULE_ROUTES: Record<StatusCountsModule, string> = {
  sales_orders: "/sales/orders",
  customer_invoices: "/sales/invoices",
  purchase_orders: "/purchase/orders",
  vendor_bills: "/purchase/bills",
  budgets: "/account/budgets",
};

/**
 * The query parameter each module filters on. Documents call it `status`;
 * a budget's lifecycle column is `state`, and its endpoint accepts only that
 * name — sending `status` there is silently ignored and returns everything,
 * which is exactly the kind of chip that lies about what it will show.
 */
export const MODULE_FILTER_PARAM: Record<StatusCountsModule, "status" | "state"> = {
  sales_orders: "status",
  customer_invoices: "status",
  purchase_orders: "status",
  vendor_bills: "status",
  budgets: "state",
};

export const MODULE_LABELS: Record<StatusCountsModule, string> = {
  sales_orders: "Sales orders",
  customer_invoices: "Customer invoices",
  purchase_orders: "Purchase orders",
  vendor_bills: "Vendor bills",
  budgets: "Budgets",
};

/**
 * The order states are shown in: the document's own lifecycle, not
 * alphabetical. A reader scanning left to right is following the workflow.
 */
const STATE_ORDER = [
  "DRAFT",
  "CONFIRMED",
  "POSTED",
  "PARTIAL",
  "PAID",
  "INVOICED",
  "BILLED",
  "REVISED",
  "CANCELLED",
];

/**
 * CANCELLED is hidden when it is empty. Every other state stays visible at
 * zero, because "0 drafts" is information; a cancelled column that has never
 * been used is just noise on a demo screen.
 */
const HIDE_WHEN_EMPTY = new Set(["CANCELLED", "REVISED"]);

export interface StatusChip {
  /** null for the "All" chip. */
  status: string | null;
  label: string;
  count: number;
}

export function useStatusCounts() {
  const counts = useFetch(() => api.statusCounts(), []);

  // Any posting or state change moves these numbers, so they follow the same
  // live-refresh rule as the KPI tiles rather than going stale until reload.
  useEventStream({
    "document.posted": () => counts.reload(),
    "payment.registered": () => counts.reload(),
    "ledger.changed": () => counts.reload(),
  });

  const chipsFor = useCallback(
    (module: StatusCountsModule): StatusChip[] => {
      const found = counts.data?.modules?.[module];
      if (!found) return [];

      const states = STATE_ORDER.filter((state) => {
        const value = found.by_status[state];
        if (value === undefined) return false;
        return value > 0 || !HIDE_WHEN_EMPTY.has(state);
      });

      return [
        { status: null, label: "All", count: found.total },
        ...states.map((state) => ({
          status: state,
          label: state.charAt(0) + state.slice(1).toLowerCase(),
          count: found.by_status[state],
        })),
      ];
    },
    [counts.data],
  );

  const modules = useMemo(
    () => (Object.keys(MODULE_LABELS) as StatusCountsModule[]).filter(
      (module) => (counts.data?.modules?.[module]?.total ?? 0) > 0,
    ),
    [counts.data],
  );

  return { loading: counts.loading, error: counts.error, reload: counts.reload, chipsFor, modules };
}

/**
 * The list-page half: the same chips, plus the `?status=` filter they drive.
 *
 * The filter lives in the URL rather than in component state for the reason
 * every other panel here does (05_FRONTEND.md §6) — "show me the drafts" stays
 * a link someone can send, bookmark or reload onto the same view.
 */
export function useStatusFilter(module: StatusCountsModule) {
  const { chipsFor, loading } = useStatusCounts();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = MODULE_FILTER_PARAM[module];
  const status = searchParams.get(param);

  const hrefFor = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set(param, next);
      else params.delete(param);
      // Opening a filtered list with a drawer still open would show a record
      // that may not belong to the new filter, so the drawer closes with it.
      params.delete("open");
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams, param],
  );

  return { status, chips: chipsFor(module), hrefFor, loading };
}
