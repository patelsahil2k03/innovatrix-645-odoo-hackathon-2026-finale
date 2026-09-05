"use client";

import { useMemo, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { ChartCard } from "@/components/ui/chart-card";
import { CategoryChart, NetProfitChart, TrendChart } from "@/components/ui/charts";
import { PageHeading } from "@/components/ui/page-heading";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CHART_OPTIONS, type ChartKind } from "@/lib/chart-types";
import { ledgerHref } from "@/lib/ledger-links";
import { useDashboardKpis } from "@/lib/use-dashboard-kpis";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { date, money } from "@/lib/format";
import Link from "next/link";

const MONTH_RANGES = [6, 12, 24] as const;

/**
 * Dashboard — the four KPIs a business actually asks about (Receivables,
 * Payables, Cash, Net Profit), plus the most recent ledger activity. Every
 * number here is a live query, never hard-coded (02_ARCHITECTURE.md §5).
 */
export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const kpis = useDashboardKpis();

  const [months, setMonths] = useState<number>(12);
  const [trendKind, setTrendKind] = useState<ChartKind>("area");
  const [netKind, setNetKind] = useState<ChartKind>("bar");
  const [breakdownKind, setBreakdownKind] = useState<ChartKind>("donut");

  const recentEntries = useFetch(
    () => api.journalEntries.list({ page: 1, page_size: 8, sort: "-entry_date" }),
    [],
  );
  const trend = useFetch(
    () => (user ? api.analytics.trend(months) : Promise.resolve(null)),
    [user, months],
  );
  const breakdown = useFetch(
    () => (user ? api.analytics.breakdown() : Promise.resolve(null)),
    [user],
  );

  useEventStream({
    "document.posted": () => {
      recentEntries.reload();
      trend.reload();
    },
    "payment.registered": () => recentEntries.reload(),
    "ledger.changed": () => {
      trend.reload();
      breakdown.reload();
    },
  });

  // Income and expense are separate compositions — one chart mixing revenue
  // slices with cost slices has no total that means anything.
  const incomeSlices = useMemo(
    () => (breakdown.data?.slices ?? []).filter((s) => s.type === "INCOME"),
    [breakdown.data],
  );

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeading
        image="/img/tabs/dashboard.webp"
        title="Dashboard"
        subtitle={`Signed in as ${user.full_name} · ${user.role.name}`}
      />

      <KpiGrid
        items={[
          {
            // The sub-line names the account the figure comes from, which is
            // the useful thing to know. It deliberately does NOT say "click
            // here": a card that has to announce it is clickable has failed to
            // look clickable, and the instruction costs the one line that could
            // carry information instead.
            label: "Receivables",
            value: kpis.loading ? "…" : money(kpis.receivables),
            sub: "Debtors (1100)",
            href: ledgerHref(kpis.receivableAccountIds, "Receivables"),
          },
          {
            label: "Payables",
            value: kpis.loading ? "…" : money(kpis.payables),
            sub: "Creditors (2000)",
            href: ledgerHref(kpis.payableAccountIds, "Payables"),
          },
          {
            // Cash spans two accounts and the ledger filter takes one, so this
            // goes to the Balance Sheet, where Cash and Bank are itemised and
            // each is separately drillable.
            label: "Cash & bank",
            value: kpis.loading ? "…" : money(kpis.cash),
            sub: "Cash (1000) · Bank (1010)",
            href: "/reports/balance-sheet",
          },
          {
            label: "Net profit",
            value: kpis.loading ? "…" : money(kpis.netProfit),
            sub: "Income − expense",
            href: "/reports/profit-and-loss",
          },
        ]}
      />

      <ChartCard
        title="Income and expense"
        subtitle={`Monthly, last ${months} months — aggregated from the same journal lines the reports read`}
        options={CHART_OPTIONS.series}
        active={trendKind}
        onSelect={setTrendKind}
        action={
          <div className="chart-switch" role="group" aria-label="Date range">
            {MONTH_RANGES.map((value) => (
              <button
                key={value}
                type="button"
                className="chart-switch-btn"
                aria-pressed={months === value}
                onClick={() => setMonths(value)}
              >
                {value}m
              </button>
            ))}
          </div>
        }
      >
        <AsyncState
          loading={trend.loading}
          error={trend.error}
          data={trend.data}
          onRetry={trend.reload}
        >
          {(data) => <TrendChart data={data.points} kind={trendKind} />}
        </AsyncState>
      </ChartCard>

      <div className="grid-2">
        <ChartCard
          title="Net profit"
          subtitle="A loss month is dimmed, not just negative"
          options={CHART_OPTIONS.series}
          active={netKind}
          onSelect={setNetKind}
        >
          <AsyncState
            loading={trend.loading}
            error={trend.error}
            data={trend.data}
            onRetry={trend.reload}
          >
            {(data) => <NetProfitChart data={data.points} kind={netKind} />}
          </AsyncState>
        </ChartCard>

        <ChartCard
          title="Revenue by analytic account"
          subtitle="Where the income came from"
          options={CHART_OPTIONS.composition}
          active={breakdownKind}
          onSelect={setBreakdownKind}
        >
          <AsyncState
            loading={breakdown.loading}
            error={breakdown.error}
            data={incomeSlices.length ? incomeSlices : null}
            emptyTitle="Nothing posted with an analytic tag yet"
            onRetry={breakdown.reload}
          >
            {(slices) => <CategoryChart data={slices} kind={breakdownKind} />}
          </AsyncState>
        </ChartCard>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Recent ledger activity</span>
          <Link href="/account/journal-entries" className="btn btn-sm">View all</Link>
        </div>

        <AsyncState
          loading={recentEntries.loading}
          error={recentEntries.error}
          data={recentEntries.data}
          isEmpty={(page) => page.items.length === 0}
          emptyTitle="Nothing posted yet"
          emptyHint="Every posted invoice, bill and payment shows up here the moment it's posted."
          onRetry={recentEntries.reload}
        >
          {(page) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Entry</th>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Source</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <Link href={`/account/journal-entries?open=${entry.id}`}>{entry.entry_number}</Link>
                      </td>
                      <td>{date(entry.entry_date)}</td>
                      <td>{entry.reference ?? "—"}</td>
                      <td>{entry.source_type}</td>
                      <td><StatusBadge status={entry.state} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>
      </div>
    </AppShell>
  );
}
