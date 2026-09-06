"use client";

/**
 * The two analytics the dashboard reads but does not compute: what is owed
 * either way and how late it is, and who the money moves through.
 *
 * Both endpoints existed, tested, before anything rendered them. This hook is
 * where their shapes become chart-ready, so no component holds a calculation
 * (brain/RULES.md §8).
 */

import { useCallback, useMemo, useState } from "react";

import { api, type AgeingReport, type ContactDirection } from "@/lib/api";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";

export interface AgeingRow {
  bucket: string;
  receivable: number;
  payable: number;
}

/**
 * The API answers with two independent lists. A grouped bar chart needs one
 * row per bucket carrying both sides, and it needs every bucket present on
 * both — a bucket where only one side has money must still render its empty
 * counterpart, or the bars silently shift and "31–60" ends up drawn under
 * the "61–90" label.
 */
export function toAgeingRows(report: AgeingReport | null): AgeingRow[] {
  if (!report) return [];

  const order: string[] = [];
  const rows = new Map<string, AgeingRow>();

  const put = (bucket: string, side: "receivable" | "payable", amount: number) => {
    if (!rows.has(bucket)) {
      rows.set(bucket, { bucket, receivable: 0, payable: 0 });
      order.push(bucket);
    }
    rows.get(bucket)![side] = amount;
  };

  // Receivables first, so the bucket order is the server's own ordering
  // (0–30 → 90+) rather than whichever side happened to have a row.
  for (const b of report.receivables) put(b.bucket, "receivable", b.amount);
  for (const b of report.payables) put(b.bucket, "payable", b.amount);

  return order.map((bucket) => rows.get(bucket)!);
}

export function useDashboardAnalytics(enabled: boolean) {
  const [direction, setDirection] = useState<ContactDirection>("customer");

  const breakdown = useFetch(
    () => (enabled ? api.analytics.breakdown() : Promise.resolve(null)),
    [enabled],
  );
  const ageing = useFetch(
    () => (enabled ? api.analytics.ageing() : Promise.resolve(null)),
    [enabled],
  );
  const topContacts = useFetch(
    () => (enabled ? api.analytics.topContacts(direction) : Promise.resolve(null)),
    [enabled, direction],
  );

  const reload = useCallback(() => {
    ageing.reload();
    topContacts.reload();
    breakdown.reload();
  }, [ageing, topContacts, breakdown]);

  // A payment changes what is outstanding and how old it is, so both follow
  // the ledger rather than waiting for a reload.
  useEventStream({
    "document.posted": reload,
    "payment.registered": reload,
    "ledger.changed": reload,
  });

  const ageingRows = useMemo(() => toAgeingRows(ageing.data), [ageing.data]);

  /** Empty means "nothing outstanding", which is a real state worth its own
   *  message rather than an axis drawn against six zeros. */
  const hasOutstanding = useMemo(
    () => ageingRows.some((row) => row.receivable > 0 || row.payable > 0),
    [ageingRows],
  );

  // Income and expense are separate compositions: one chart mixing revenue
  // slices with cost slices has no total that means anything, so which slices
  // belong in the revenue chart is decided here rather than in the markup.
  const incomeSlices = useMemo(
    () => (breakdown.data?.slices ?? []).filter((slice) => slice.type === "INCOME"),
    [breakdown.data],
  );

  return {
    breakdown: { ...breakdown, incomeSlices },
    ageing: { ...ageing, rows: ageingRows, hasOutstanding },
    topContacts,
    direction,
    setDirection,
  };
}
