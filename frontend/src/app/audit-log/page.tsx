"use client";

import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useFetch } from "@/lib/use-fetch";
import { dateTime } from "@/lib/format";

const PAGE_SIZE = 20;

/**
 * Who did what, when — admin only (`docs/04_API_CONTRACT.md` §2, enforced
 * server-side by `require_admin`). The API returns the raw `user_id`, not a
 * joined display name, so that's what's shown here too.
 */
export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("-created_at");
  const debouncedSearch = useDebouncedValue(search, 300);

  const logs = useFetch(
    () => api.auditLogs.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: sort ?? undefined }),
    [page, debouncedSearch, sort],
  );

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p>Every write the API accepted or rejected — who, what, and the response it got.</p>
        </div>
      </div>

      <SearchInput
        value={search}
        onChange={(value) => { setSearch(value); setPage(1); }}
        label="Search audit log"
        placeholder="Search by action or entity"
      />

      <div className="card">
        <AsyncState
          loading={logs.loading}
          error={logs.error}
          data={logs.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="Nothing logged yet"
          emptyHint="Every accepted or rejected write shows up here as soon as it happens."
          onRetry={logs.reload}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableTh label="When" sortKey="created_at" current={sort} onSort={setSort} />
                    <th>User</th>
                    <th>Action</th>
                    <SortableTh label="Entity" sortKey="entity_name" current={sort} onSort={setSort} />
                    <th>Entity ID</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((row) => (
                    <tr key={row.id}>
                      <td>{dateTime(row.created_at)}</td>
                      <td className="mono">{row.user_id}</td>
                      <td>{row.action}</td>
                      <td>{row.entity_name}</td>
                      <td className="mono">{row.entity_id ?? "—"}</td>
                      <td>
                        <StatusBadge
                          status={String(row.status_code)}
                          tone={row.status_code < 400 ? "ok" : "danger"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>

        {logs.data ? (
          <Pagination page={logs.data.page} pages={logs.data.pages} total={logs.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>
    </AppShell>
  );
}
