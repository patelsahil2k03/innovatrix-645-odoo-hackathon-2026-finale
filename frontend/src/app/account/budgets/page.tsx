"use client";

import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { BudgetDonut } from "@/components/ui/budget-donut";
import { KanbanGrid } from "@/components/ui/kanban";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { ViewToggle, type ListView } from "@/components/ui/view-toggle";
import { PlusIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { aggregateBudgetLines } from "@/lib/budget-helpers";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useFetch } from "@/lib/use-fetch";
import { date } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function BudgetsPage() {
  const { user } = useAuth();
  const [view, setView] = useState<ListView>("list");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const budgets = useFetch(
    () => api.budgets.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: "-period_start" }),
    [page, debouncedSearch],
  );

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Analytical Budget</h1>
          <p>Planned vs. achieved, by analytic account and period.</p>
        </div>
        {can.record(user?.role.name) ? (
          <Link href="/account/budgets/new" className="btn btn-primary">
            <PlusIcon size={14} />
            New budget
          </Link>
        ) : null}
      </div>

      <div className="row-between">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} label="Search budgets" />
        <ViewToggle value={view} onChange={setView} />
      </div>

      <div className="card">
        <AsyncState
          loading={budgets.loading}
          error={budgets.error}
          data={budgets.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No budgets yet"
          onRetry={budgets.reload}
        >
          {(pageData) =>
            view === "list" ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Name</th><th>Period</th><th>Responsible</th><th>State</th><th>Achieved</th></tr>
                  </thead>
                  <tbody>
                    {pageData.items.map((budget) => {
                      const aggregate = aggregateBudgetLines(budget.lines);
                      return (
                        <tr key={budget.id}>
                          <td><Link href={`/account/budgets/${budget.id}`}>{budget.name}</Link></td>
                          <td>{date(budget.period_start)} – {date(budget.period_end)}</td>
                          <td>{budget.responsible_name ?? "—"}</td>
                          <td><StatusBadge status={budget.state} /></td>
                          <td><BudgetDonut achievedPct={aggregate.achievedPct} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <KanbanGrid
                items={pageData.items.map((budget) => {
                  const aggregate = aggregateBudgetLines(budget.lines);
                  return {
                    id: budget.id,
                    title: budget.name,
                    subtitle: `${date(budget.period_start)} – ${date(budget.period_end)}`,
                    meta: budget.responsible_name ?? undefined,
                    href: `/account/budgets/${budget.id}`,
                    badge: <BudgetDonut achievedPct={aggregate.achievedPct} size={32} />,
                  };
                })}
              />
            )
          }
        </AsyncState>

        {budgets.data ? (
          <Pagination page={budgets.data.page} pages={budgets.data.pages} total={budgets.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>
    </AppShell>
  );
}
