"use client";

import { memo, useCallback, useState, type ChangeEvent } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { CategoryBarChart } from "@/components/ui/bar-chart";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { DrillAmount } from "@/components/ui/drill-amount";
import { Field } from "@/components/ui/field";
import { SkeletonCard } from "@/components/ui/skeleton";
import { PageHeading } from "@/components/ui/page-heading";
import { DownloadIcon } from "@/components/icons";
import { api, type ReportGroup } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { money } from "@/lib/format";

const GroupTable = memo(function GroupTable({ group }: { group: ReportGroup }) {
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">{group.label}</span></div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Account</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>
            {group.rows.map((row) => (
              <tr key={row.account_id}>
                <td className="mono">{row.account_code}</td>
                <td>{row.account_name}</td>
                <td className="num">
                  <DrillAmount
                    value={row.balance}
                    href={`/account/journal-entries?account_id=${row.account_id}&account_label=${encodeURIComponent(`${row.account_code} ${row.account_name}`)}&from=/reports/profit-and-loss&from_label=${encodeURIComponent("Profit and Loss")}`}
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
    </div>
  );
});

export default function ProfitAndLossPage() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const handleDateFromChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDateFrom(event.target.value),
    [],
  );
  const handleDateToChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDateTo(event.target.value),
    [],
  );
  const report = useFetch(
    () =>
      user
        ? api.reports.profitAndLoss(dateFrom || undefined, dateTo || undefined)
        : Promise.resolve(null),
    [user, dateFrom, dateTo],
  );
  useEventStream({ "ledger.changed": () => report.reload() }, !!user);

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Report" }, { label: "Profit and Loss" }]} />
      <PageHeading
        image="/img/tabs/profit-and-loss.webp"
        title="Profit and Loss"
        subtitle="Income and expense for the period — computed from the ledger, not from documents."
        action={
          <a className="btn btn-sm" href={api.reports.pdfUrl("profit-and-loss", { date_from: dateFrom, date_to: dateTo })} target="_blank" rel="noreferrer">
            <DownloadIcon size={14} /> PDF
          </a>
        }
      />

      <div className="card row">
        <Field label="From">
          {(props) => <input {...props} className="input" type="date" value={dateFrom} onChange={handleDateFromChange} />}
        </Field>
        <Field label="To">
          {(props) => <input {...props} className="input" type="date" value={dateTo} onChange={handleDateToChange} />}
        </Field>
      </div>

      <AsyncState
        loading={report.loading}
        error={report.error}
        data={report.data}
        onRetry={report.reload}
        skeleton={<SkeletonCard lines={6} />}
      >
        {(data) => (
          <>
            <div className="card">
              <div className="card-head"><span className="card-title">Income vs. expenses</span></div>
              <CategoryBarChart
                items={[
                  { label: "Income", value: data.income.total, colorVar: "var(--chart-1)" },
                  { label: "Expenses", value: data.expenses.total, colorVar: "var(--chart-2)" },
                  { label: "Other expenses", value: data.other_expenses.total, colorVar: "var(--chart-3)" },
                ]}
              />
            </div>
            <div className="grid-2">
              <GroupTable group={data.income} />
              <div className="stack">
                <GroupTable group={data.expenses} />
                <GroupTable group={data.other_expenses} />
              </div>
            </div>
            <div className="kpi-grid">
              <div className="kpi">
                <span className="kpi-label">Net profit</span>
                <span className="kpi-value">{money(data.net_profit)}</span>
                <span className="kpi-sub">Income − Expense − Other expense</span>
              </div>
            </div>
          </>
        )}
      </AsyncState>
    </AppShell>
  );
}
