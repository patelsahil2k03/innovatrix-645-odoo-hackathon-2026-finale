"use client";

import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { DrillAmount } from "@/components/ui/drill-amount";
import { Field } from "@/components/ui/field";
import { DownloadIcon } from "@/components/icons";
import { api, type ReportGroup } from "@/lib/api";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { money } from "@/lib/format";

function GroupTable({ group }: { group: ReportGroup }) {
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
}

export default function ProfitAndLossPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const report = useFetch(() => api.reports.profitAndLoss(dateFrom || undefined, dateTo || undefined), [dateFrom, dateTo]);
  useEventStream({ "ledger.changed": () => report.reload() });

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Profit and Loss</h1>
          <p>Income and expense for the period — computed from the ledger, not from documents.</p>
        </div>
        <a className="btn btn-sm" href={api.reports.pdfUrl("profit-and-loss", { date_from: dateFrom, date_to: dateTo })} target="_blank" rel="noreferrer">
          <DownloadIcon size={14} /> PDF
        </a>
      </div>

      <div className="card row">
        <Field label="From">
          {(props) => <input {...props} className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />}
        </Field>
        <Field label="To">
          {(props) => <input {...props} className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />}
        </Field>
      </div>

      <AsyncState loading={report.loading} error={report.error} data={report.data} onRetry={report.reload}>
        {(data) => (
          <>
            <div className="grid-2">
              <GroupTable group={data.income} />
              <div className="stack">
                <GroupTable group={data.expense} />
                <GroupTable group={data.other_expense} />
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
