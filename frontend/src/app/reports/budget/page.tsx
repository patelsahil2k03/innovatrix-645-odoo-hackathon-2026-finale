"use client";

import { memo, useCallback, useMemo, useState, type ChangeEvent } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { GroupedBarChart } from "@/components/ui/bar-chart";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Field } from "@/components/ui/field";
import { PageHeading } from "@/components/ui/page-heading";
import { SkeletonTable } from "@/components/ui/skeleton";
import { api, type BudgetReportRow } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { humanize, money } from "@/lib/format";

const BudgetReportRowView = memo(function BudgetReportRowView({ row }: { row: BudgetReportRow }) {
  const overBudget = row.amount_to_achieve < 0;
  return (
    <tr>
      <td>{row.analytic_account}</td>
      <td>{humanize(row.type)}</td>
      <td className="num">{money(row.committed_amount)}</td>
      <td className="num">{money(row.achieved_amount)}</td>
      <td className="num" style={overBudget ? { color: "var(--danger)", fontWeight: 700 } : undefined}>
        {overBudget ? "−" : "+"}{money(Math.abs(row.amount_to_achieve))}
      </td>
    </tr>
  );
});

export default function BudgetReportPage() {
  const [budgetId, setBudgetId] = useState("");
  const budgets = useFetch(() => api.budgets.list({ page_size: 100, sort: "-period_start" }), []);
  const report = useFetch(() => (budgetId ? api.reports.budget(budgetId) : Promise.resolve(null)), [budgetId]);
  const handleBudgetChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => setBudgetId(event.target.value),
    [],
  );
  const budgetOptions = useMemo(() => budgets.data?.items ?? [], [budgets.data]);

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Report" }, { label: "Budget Report" }]} />
      <PageHeading
        image="/img/tabs/budget-report.webp"
        title="Budget Report"
        subtitle="Planned vs. actual vs. variance, per analytic account."
      />

      <div className="card">
        <Field label="Budget" required>
          {(props) => (
            <select {...props} className="select" value={budgetId} onChange={handleBudgetChange}>
              <option value="">Select a budget…</option>
              {budgetOptions.map((budget) => (
                <option key={budget.id} value={budget.id}>{budget.name}</option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {budgetId ? (
        <AsyncState
          loading={report.loading}
          error={report.error}
          data={report.data}
          isEmpty={(r) => r.lines.length === 0}
          emptyTitle="No lines on this budget"
          onRetry={report.reload}
          skeleton={<SkeletonTable rows={5} columns={5} />}
        >
          {(data) => (
            <>
              <div className="card">
                <div className="card-head"><span className="card-title">Committed vs. achieved, by analytic account</span></div>
                <GroupedBarChart
                  series={[
                    { label: "Committed", colorVar: "var(--chart-1)" },
                    { label: "Achieved", colorVar: "var(--chart-3)" },
                  ]}
                  rows={data.lines.map((row) => ({
                    label: row.analytic_account,
                    values: [row.committed_amount, row.achieved_amount],
                  }))}
                />
              </div>
              <div className="card">
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Analytic account</th>
                        <th>Type</th>
                        <th style={{ textAlign: "right" }}>Planned</th>
                        <th style={{ textAlign: "right" }}>Actual</th>
                        <th style={{ textAlign: "right" }}>Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lines.map((row) => (
                        <BudgetReportRowView key={row.analytic_account_id} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </AsyncState>
      ) : null}
    </AppShell>
  );
}
