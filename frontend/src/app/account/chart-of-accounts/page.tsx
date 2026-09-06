"use client";

import Link from "next/link";
import { Suspense, useCallback, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { PageHeading } from "@/components/ui/page-heading";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { AccountForm, accountToFormValues } from "@/components/forms/account-form";
import { PlusIcon } from "@/components/icons";
import { api, type AccountCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useDrawerParam } from "@/lib/use-drawer-param";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { humanize } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function ChartOfAccountsPage() {
  return (
    <Suspense fallback={null}>
      <ChartOfAccountsPageInner />
    </Suspense>
  );
}

function ChartOfAccountsPageInner() {
  const { user } = useAuth();
  const toast = useToast();
  const panel = useDrawerParam();
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

  const canRecord = can.record(user?.role.name);
  const canManage = can.manageMasterData(user?.role.name);

  // Fetched by id rather than read off the currently loaded page, so
  // `?open=<id>` stays a real, reloadable link regardless of search/sort/page.
  const editingId = panel.openId;
  const editingAccount = useFetch(
    () => (editingId ? api.accounts.get(editingId) : Promise.resolve(null)),
    [editingId],
  );

  async function handleCreate(values: AccountCreate) {
    await api.accounts.create(values);
    toast.success("Account created");
    panel.close();
    accounts.reload();
  }

  async function handleUpdate(values: AccountCreate) {
    if (!editingId) return;
    await api.accounts.update(editingId, values);
    toast.success("Account updated");
    panel.close();
    accounts.reload();
  }

  const archiveAction = useConfirmAction(async () => {
    if (!editingId) return;
    await api.accounts.archive(editingId);
    toast.success("Account archived");
    panel.close();
    accounts.reload();
  });

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Chart of Account" }]} />
      <PageHeading
        image="/img/tabs/chart-of-accounts.webp"
        title="Chart of Accounts"
        subtitle="The general ledger's accounts — pre-configured, rarely added to."
        action={
          canRecord ? (
            <Link href={panel.hrefFor("new")} className="btn btn-primary">
              <PlusIcon size={14} />
              New account
            </Link>
          ) : null
        }
      />

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
                      <td><Link href={panel.hrefFor(account.id)}>{account.name}</Link></td>
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

      <Drawer open={panel.isNew} onClose={panel.close} title="New account">
        <AccountForm onSubmit={handleCreate} submitLabel="Create account" />
      </Drawer>

      <Drawer
        open={panel.openId !== null}
        onClose={panel.close}
        title={editingAccount.data ? `${editingAccount.data.code} — ${editingAccount.data.name}` : "Account"}
       
        footer={
          editingAccount.data && canManage && !editingAccount.data.is_archived ? (
            <button type="button" className="btn btn-danger" onClick={archiveAction.request}>
              Archive
            </button>
          ) : null
        }
      >
        <AsyncState
          loading={editingAccount.loading}
          error={editingAccount.error}
          data={editingAccount.data}
          onRetry={editingAccount.reload}
          skeleton={<SkeletonCard lines={3} />}
        >
          {(data) => (
            <>
              <StatusBadge status={data.is_archived ? "archived" : "active"} />
              {!canManage ? (
                <div className="alert alert-info">Only an Admin can modify or archive master data.</div>
              ) : null}
              {data.is_archived ? (
                <div className="alert alert-info">
                  Archiving never touches history — postings already made to this account stay exactly
                  as they were and still appear in every report covering their period.
                </div>
              ) : null}
              <AccountForm
                initial={accountToFormValues(data)}
                onSubmit={handleUpdate}
                submitLabel="Save changes"
                readOnly={!canManage || data.is_archived}
              />
            </>
          )}
        </AsyncState>
      </Drawer>

      <ConfirmDialog
        open={archiveAction.open}
        onCancel={archiveAction.cancel}
        onConfirm={archiveAction.confirm}
        pending={archiveAction.pending}
        error={archiveAction.error}
        tone="danger"
        title="Archive this account?"
        confirmLabel="Archive account"
        pendingLabel="Archiving…"
        description={
          editingAccount.data ? (
            <p>
              {editingAccount.data.code} — {editingAccount.data.name} will no longer appear in pickers for new document
              lines. Postings already made to it stay exactly as they are and still appear
              in every report covering their period, but there is no way to unarchive it
              from the app yet.
            </p>
          ) : null
        }
      />
    </AppShell>
  );
}
