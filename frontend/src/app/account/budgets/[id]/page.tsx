"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { DrillAmount } from "@/components/ui/drill-amount";
import { SkeletonCard } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { ClosePanel } from "@/components/ui/close-panel";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formMessageFrom } from "@/lib/validation";
import { useFetch } from "@/lib/use-fetch";
import { date, money, percent } from "@/lib/format";
import { can } from "@/lib/roles";

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const budget = useFetch(() => api.budgets.get(id), [id]);
  const { reload: reloadBudget } = budget;
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canRecord = can.record(user?.role.name);

  const handleConfirm = useCallback(async () => {
    setWorking(true);
    setActionError(null);
    try {
      await api.budgets.confirm(id);
      reloadBudget();
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }, [id, reloadBudget]);

  const handleRevise = useCallback(async () => {
    setWorking(true);
    setActionError(null);
    try {
      const revised = await api.budgets.revise(id);
      router.push(`/account/budgets/${revised.id}`);
    } catch (error) {
      setActionError(formMessageFrom(error));
      setWorking(false);
    }
  }, [id, router]);

  const handleCancel = useCallback(async () => {
    setWorking(true);
    setActionError(null);
    try {
      await api.budgets.cancel(id);
      reloadBudget();
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }, [id, reloadBudget]);

  return (
    <AppShell>
      <Breadcrumbs
        items={[
          { label: "Account" },
          { label: "Analytical Budget", href: "/account/budgets" },
          { label: budget.data?.name ?? "…" },
        ]}
      />
      <AsyncState
        loading={budget.loading}
        error={budget.error}
        data={budget.data}
        onRetry={budget.reload}
        skeleton={<SkeletonCard lines={4} />}
      >
        {(data) => (
          <>
            <div className="page-head">
              <div>
                <h1>{data.name}</h1>
                <p>
                  <StatusBadge status={data.state} /> · {date(data.period_start)} – {date(data.period_end)}
                  {data.responsible_name ? <> · {data.responsible_name}</> : null}
                </p>
              </div>
              {canRecord ? (
                <div className="row">
                  {data.state === "DRAFT" ? (
                    <button type="button" className="btn" onClick={handleCancel} disabled={working}>Cancel</button>
                  ) : null}
                  {data.state === "DRAFT" ? (
                    <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={working}>Confirm</button>
                  ) : null}
                  {data.state === "CONFIRMED" ? (
                    <button type="button" className="btn btn-primary" onClick={handleRevise} disabled={working}>Revise</button>
                  ) : null}
                </div>
              ) : null}
              <ClosePanel />
            </div>

            {actionError ? <div className="alert alert-danger" role="alert">{actionError}</div> : null}

            {data.revision_of_id ? (
              <div className="alert alert-info">
                This is a revision of <Link href={`/account/budgets/${data.revision_of_id}`}>an earlier budget</Link>.
              </div>
            ) : null}
            {data.revised_with_id ? (
              <div className="alert alert-info">
                Superseded by <Link href={`/account/budgets/${data.revised_with_id}`}>its revision</Link> — this
                budget&apos;s own figures stay exactly as they were.
              </div>
            ) : null}

            <div className="card">
              <div className="card-head"><span className="card-title">Budget lines</span></div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Analytic account</th>
                      <th style={{ textAlign: "right" }}>Committed</th>
                      <th style={{ textAlign: "right" }}>Achieved</th>
                      <th style={{ textAlign: "right" }}>Achieved %</th>
                      <th style={{ textAlign: "right" }}>To achieve</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.analytic_account_name ?? "—"}</td>
                        <td className="num">{money(line.committed_amount)}</td>
                        <td className="num">
                          {line.id ? (
                            <DrillAmount
                              value={line.achieved_amount ?? 0}
                              href={`/account/budgets/${id}/lines/${line.id}/documents`}
                            />
                          ) : (
                            money(line.achieved_amount ?? 0)
                          )}
                        </td>
                        <td className="num">{percent(line.achieved_pct ?? 0)}</td>
                        <td className="num">{money(line.amount_to_achieve ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
              <Link href="/account/budgets">← Back to budgets</Link>
            </p>
          </>
        )}
      </AsyncState>
    </AppShell>
  );
}
