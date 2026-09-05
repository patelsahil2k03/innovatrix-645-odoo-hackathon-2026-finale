"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlusIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useFetch } from "@/lib/use-fetch";
import { humanize } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function ChartOfAccountsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("code");
  const debouncedSearch = useDebouncedValue(search, 300);

  const accounts = useFetch(
    () => api.accounts.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: sort ?? undefined }),
    [page, debouncedSearch, sort],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Chart of Account" }]} />
      <div className="page-head">
        <div>
          <h1>Chart of Accounts</h1>
          <p>The general ledger&apos;s accounts — pre-configured, rarely added to.</p>
        </div>
        {can.record(user?.role.name) ? (
          <Link href="/account/chart-of-accounts/new" className="btn btn-primary">
            <PlusIcon size={14} />
            New account
          </Link>
        ) : null}
      </div>

      <SearchInput value={search} onChange={handleSearchChange} label="Search accounts" placeholder="Search by code or name" />

      <div className="card">
        <AsyncState
          loading={accounts.loading}
          error={accounts.error}
          data={accounts.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No accounts yet"
          emptyHint="The Chart of Accounts must be seeded before anything can post."
          onRetry={accounts.reload}
          skeleton={<SkeletonTable rows={6} columns={4} />}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableTh label="Code" sortKey="code" current={sort} onSort={setSort} />
                    <SortableTh label="Name" sortKey="name" current={sort} onSort={setSort} />
                    <SortableTh label="Type" sortKey="type" current={sort} onSort={setSort} />
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((account) => (
                    <tr key={account.id}>
                      <td className="mono">{account.code}</td>
                      <td><Link href={`/account/chart-of-accounts/${account.id}`}>{account.name}</Link></td>
                      <td>{humanize(account.type)}</td>
                      <td>{account.is_archived ? <StatusBadge status="archived" /> : <StatusBadge status="active" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>

        {accounts.data ? (
          <Pagination page={accounts.data.page} pages={accounts.data.pages} total={accounts.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>
    </AppShell>
  );
}
