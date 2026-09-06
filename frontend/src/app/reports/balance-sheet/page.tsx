"use client";

import { memo } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { CategoryBarChart } from "@/components/ui/bar-chart";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { DrillAmount } from "@/components/ui/drill-amount";
import { SkeletonCard } from "@/components/ui/skeleton";
import { PageHeading } from "@/components/ui/page-heading";
import { DownloadIcon } from "@/components/icons";
import { api, type ReportGroup } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { date, money } from "@/lib/format";

const GroupTable = memo(function GroupTable({ group, asOf }: { group: ReportGroup; asOf: string }) {
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">{group.label}</span></div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Account</th><th style={{ textAlign: "right" }}>Balance</th></tr></thead>
          <tbody>
            {group.rows.map((row) => (
              <tr key={row.account_id}>
                <td className="mono">{row.account_code}</td>
                <td>{row.account_name}</td>
                <td className="num">
                  <DrillAmount
                    value={row.balance}
                    href={`/account/journal-entries?account_id=${row.account_id}&account_label=${encodeURIComponent(`${row.account_code} ${row.account_name}`)}&from=/reports/balance-sheet&from_label=${encodeURIComponent("Balance Sheet")}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ fontWeight: 700 }}>Total {group.label}</td>
              <td className="num" style={{ fontWeight: 700 }}>{money(group.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p style={{ fontSize: "var(--t-xs)", color: "var(--text-faint)", marginTop: 8 }}>As of {date(asOf)}</p>
    </div>
  );
});

export default function BalanceSheetPage() {
  const { user } = useAuth();
  const report = useFetch(
    () => (user ? api.reports.balanceSheet() : Promise.resolve(null)),
    [user],
  );
  useEventStream({ "ledger.changed": () => report.reload() }, !!user);

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Report" }, { label: "Balance Sheet" }]} />
      <PageHeading
        image="/img/tabs/balance-sheet.webp"
        title="Balance Sheet"
        subtitle="Every figure is a link — click through to the journal lines that make it up."
        action={
          <a className="btn btn-sm" href={api.reports.pdfUrl("balance-sheet")} target="_blank" rel="noreferrer">
            <DownloadIcon size={14} /> PDF
          </a>
        }
      />

      <AsyncState
        loading={report.loading}
        error={report.error}
        data={report.data}
        onRetry={report.reload}
        skeleton={<SkeletonCard lines={6} />}
      >
        {(data) => (
          <>
            {!data.is_balanced ? (
              <div className="alert alert-danger" role="alert">
                Assets do not equal Liabilities + Equity — something upstream is unbalanced. This should be
                unreachable; check the trial balance badge.
              </div>
            ) : null}
            <div className="card">
              <div className="card-head"><span className="card-title">Assets vs. liabilities + equity</span></div>
              <CategoryBarChart
                items={[
                  { label: "Assets", value: data.assets.total, colorVar: "var(--chart-1)" },
                  { label: "Liabilities", value: data.liabilities.total, colorVar: "var(--chart-2)" },
                  { label: "Equity", value: data.equity.total, colorVar: "var(--chart-3)" },
                ]}
              />
            </div>
            <div className="grid-2">
              <GroupTable group={data.assets} asOf={data.as_of} />
              <div className="stack">
                <GroupTable group={data.liabilities} asOf={data.as_of} />
                <GroupTable group={data.equity} asOf={data.as_of} />
              </div>
            </div>
          </>
        )}
      </AsyncState>
    </AppShell>
  );
}
