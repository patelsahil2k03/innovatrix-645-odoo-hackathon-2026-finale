"use client";

import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlusIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useFetch } from "@/lib/use-fetch";
import { humanize } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function JournalsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const journals = useFetch(
    () => api.journals.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: "name" }),
    [page, debouncedSearch],
  );

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Journals</h1>
          <p>Where a payment posts — Bank, Cash, Sales, Purchase, Misc.</p>
        </div>
        {can.record(user?.role.name) ? (
          <Link href="/account/journals/new" className="btn btn-primary">
            <PlusIcon size={14} />
            New journal
          </Link>
        ) : null}
      </div>

      <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} label="Search journals" />

      <div className="card">
        <AsyncState
          loading={journals.loading}
          error={journals.error}
          data={journals.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No journals yet"
          onRetry={journals.reload}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Type</th><th>Status</th></tr></thead>
                <tbody>
                  {pageData.items.map((journal) => (
                    <tr key={journal.id}>
                      <td><Link href={`/account/journals/${journal.id}`}>{journal.name}</Link></td>
                      <td>{humanize(journal.type)}</td>
                      <td>{journal.is_archived ? <StatusBadge status="archived" /> : <StatusBadge status="active" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>

        {journals.data ? (
          <Pagination page={journals.data.page} pages={journals.data.pages} total={journals.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>
    </AppShell>
  );
}
