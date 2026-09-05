"use client";

import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { humanize, money } from "@/lib/format";

export default function BudgetReportPage() {
  const [budgetId, setBudgetId] = useState("");
  const budgets = useFetch(() => api.budgets.list({ page_size: 200, sort: "-period_start" }), []);
  const report = useFetch(() => (budgetId ? api.reports.budget(budgetId) : Promise.resolve(null)), [budgetId]);

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Budget Report</h1>
          <p>Planned vs. actual vs. variance, per analytic account.</p>
        </div>
      </div>

      <div className="card">
        <Field label="Budget" required>
          {(props) => (
            <select {...props} className="select" value={budgetId} onChange={(event) => setBudgetId(event.target.value)}>
              <option value="">Select a budget…</option>
              {(budgets.data?.items ?? []).map((budget) => (
                <option key={budget.id} value={budget.id}>{budget.name}</option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {budgetId ? (
        <div className="card">
          <AsyncState
            loading={report.loading}
            error={report.error}
            data={report.data}
            isEmpty={(r) => r.rows.length === 0}
            emptyTitle="No lines on this budget"
            onRetry={report.reload}
          >
            {(data) => (
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
                    {data.rows.map((row) => {
                      const overBudget = row.variance < 0;
                      return (
                        <tr key={row.analytic_account_id}>
                          <td>{row.analytic_account}</td>
                          <td>{humanize(row.type)}</td>
                          <td className="num">{money(row.planned)}</td>
                          <td className="num">{money(row.actual)}</td>
                          <td className="num" style={overBudget ? { color: "var(--danger)", fontWeight: 700 } : undefined}>
                            {overBudget ? "−" : "+"}{money(Math.abs(row.variance))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </AsyncState>
        </div>
      ) : null}
    </AppShell>
  );
}
