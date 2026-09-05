"use client";

import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { KanbanGrid } from "@/components/ui/kanban";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { ViewToggle, type ListView } from "@/components/ui/view-toggle";
import { PlusIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useFetch } from "@/lib/use-fetch";
import { humanize } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function AnalyticAccountsPage() {
  const { user } = useAuth();
  const [view, setView] = useState<ListView>("list");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const rows = useFetch(
    () => api.analyticAccounts.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: "name" }),
    [page, debouncedSearch],
  );

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Analyticals</h1>
          <p>Analytic accounts — the tags that measure a budget without touching the Chart of Accounts.</p>
        </div>
        {can.record(user?.role.name) ? (
          <Link href="/account/analyticals/new" className="btn btn-primary">
            <PlusIcon size={14} />
            New analytic account
          </Link>
        ) : null}
      </div>

      <div className="row-between">
        <SearchInput
          value={search}
          onChange={(value) => { setSearch(value); setPage(1); }}
          label="Search analytic accounts"
        />
        <ViewToggle value={view} onChange={setView} />
      </div>

      <div className="card">
        <AsyncState
          loading={rows.loading}
          error={rows.error}
          data={rows.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No analytic accounts yet"
          onRetry={rows.reload}
        >
          {(pageData) =>
            view === "list" ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Name</th><th>Type</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {pageData.items.map((row) => (
                      <tr key={row.id}>
                        <td><Link href={`/account/analyticals/${row.id}`}>{row.name}</Link></td>
                        <td>{humanize(row.type)}</td>
                        <td>{row.is_archived ? <StatusBadge status="archived" /> : <StatusBadge status="active" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <KanbanGrid
                items={pageData.items.map((row) => ({
                  id: row.id,
                  title: row.name,
                  subtitle: humanize(row.type),
                  href: `/account/analyticals/${row.id}`,
                  badge: row.is_archived ? <span className="badge badge-neutral">Archived</span> : undefined,
                }))}
              />
            )
          }
        </AsyncState>

        {rows.data ? (
          <Pagination page={rows.data.page} pages={rows.data.pages} total={rows.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>
    </AppShell>
  );
}
