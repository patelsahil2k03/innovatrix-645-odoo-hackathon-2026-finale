"use client";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDashboardKpis } from "@/lib/use-dashboard-kpis";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { date, money } from "@/lib/format";
import Link from "next/link";

/**
 * Dashboard — the four KPIs a business actually asks about (Receivables,
 * Payables, Cash, Net Profit), plus the most recent ledger activity. Every
 * number here is a live query, never hard-coded (02_ARCHITECTURE.md §5).
 */
export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const kpis = useDashboardKpis();

  const recentEntries = useFetch(
    () => api.journalEntries.list({ page: 1, page_size: 8, sort: "-entry_date" }),
    [],
  );
  useEventStream({
    "document.posted": () => recentEntries.reload(),
    "payment.registered": () => recentEntries.reload(),
  });

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Signed in as {user.full_name} · {user.role.name}</p>
        </div>
      </div>

      <KpiGrid
        items={[
          { label: "Receivables", value: kpis.loading ? "…" : money(kpis.receivables), sub: "Debtors (1100)" },
          { label: "Payables", value: kpis.loading ? "…" : money(kpis.payables), sub: "Creditors (2000)" },
          { label: "Cash & bank", value: kpis.loading ? "…" : money(kpis.cash), sub: "1000 · 1010" },
          { label: "Net profit", value: kpis.loading ? "…" : money(kpis.netProfit), sub: "This period" },
        ]}
      />

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
