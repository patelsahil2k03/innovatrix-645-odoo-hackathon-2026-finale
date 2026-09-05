"use client";

/**
 * Dashboard KPI tiles — Receivables, Payables, Cash, Net Profit. Computed once
 * from the two reports on load, then kept live from the `kpi.refresh` SSE
 * payload (04_API_CONTRACT.md §3.10) without a refetch — the most convincing
 * proof that a number is "changing live, from our database" (02_ARCHITECTURE.md
 * §5). A .tsx file only renders what this hook returns.
 */

import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useEventStream } from "@/lib/use-event-stream";

export interface DashboardKpis {
  receivables: number | null;
  payables: number | null;
  cash: number | null;
  netProfit: number | null;
  loading: boolean;
  error: string | null;
}

const RECEIVABLE_CODES = ["1100"];
const PAYABLE_CODES = ["2000"];
const CASH_CODES = ["1000", "1010"];

function sumByCode(rows: { account_code: string; balance: number }[] | undefined, codes: string[]): number {
  if (!rows) return 0;
  return rows.filter((row) => codes.includes(row.account_code)).reduce((sum, row) => sum + row.balance, 0);
}

export function useDashboardKpis(): DashboardKpis {
  const [state, setState] = useState<DashboardKpis>({
    receivables: null,
    payables: null,
    cash: null,
    netProfit: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [balanceSheet, profitAndLoss] = await Promise.all([
          api.reports.balanceSheet(),
          api.reports.profitAndLoss(),
        ]);
        if (cancelled) return;
        setState({
          receivables: sumByCode(balanceSheet.assets.rows, RECEIVABLE_CODES),
          payables: sumByCode(balanceSheet.liabilities.rows, PAYABLE_CODES),
          cash: sumByCode(balanceSheet.assets.rows, CASH_CODES),
          netProfit: profitAndLoss.net_profit,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof ApiError ? error.message : "Something went wrong.",
        }));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEventStream({
    "kpi.refresh": (payload) => {
      setState((prev) => ({
        ...prev,
        receivables: typeof payload.receivables === "number" ? payload.receivables : prev.receivables,
        payables: typeof payload.payables === "number" ? payload.payables : prev.payables,
        cash: typeof payload.cash === "number" ? payload.cash : prev.cash,
        netProfit: typeof payload.net_profit === "number" ? payload.net_profit : prev.netProfit,
      }));
    },
  });

  return state;
}
