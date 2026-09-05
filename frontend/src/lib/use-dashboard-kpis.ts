"use client";

/**
 * Dashboard KPI tiles — Receivables, Payables, Cash, Net Profit. Read once from
 * `GET /reports/kpis` on load (04_API_CONTRACT.md §4: "tiles need a value before
 * the first event arrives"), then kept live from the `kpi.refresh` SSE payload
 * (§3.10) without a refetch. A .tsx file only renders what this hook returns.
 */

import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useEventStream } from "@/lib/use-event-stream";

export interface DashboardKpis {
  receivables: number | null;
  payables: number | null;
  cash: number | null;
  netProfit: number | null;
  loading: boolean;
  error: string | null;
}

export function useDashboardKpis(): DashboardKpis {
  const { user } = useAuth();
  const [state, setState] = useState<DashboardKpis>({
    receivables: null,
    payables: null,
    cash: null,
    netProfit: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        const kpis = await api.reports.kpis();
        if (cancelled) return;
        setState({
          receivables: kpis.receivables,
          payables: kpis.payables,
          cash: kpis.cash,
          netProfit: kpis.net_profit,
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
  }, [user]);

  useEventStream(
    {
      "kpi.refresh": (payload) => {
        setState((prev) => ({
          ...prev,
          receivables: typeof payload.receivables === "number" ? payload.receivables : prev.receivables,
          payables: typeof payload.payables === "number" ? payload.payables : prev.payables,
          cash: typeof payload.cash === "number" ? payload.cash : prev.cash,
          netProfit: typeof payload.net_profit === "number" ? payload.net_profit : prev.netProfit,
        }));
      },
    },
    !!user,
  );

  return state;
}
