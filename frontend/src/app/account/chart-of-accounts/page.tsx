"use client";

import { useCallback, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { AccountForm, accountToFormValues } from "@/components/forms/account-form";
import { PlusIcon } from "@/components/icons";
import { api, type Account, type AccountCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useDrawer } from "@/lib/use-drawer";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { humanize } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function ChartOfAccountsPage() {
  const { user } = useAuth();
  const toast = useToast();
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

  // Create and edit each open in the same right-side drawer instead of a
  // page navigation, so working the Chart of Accounts stays on one screen.
  const createDrawer = useDrawer();
  const [editing, setEditing] = useState<Account | null>(null);

  async function handleCreate(values: AccountCreate) {
    await api.accounts.create(values);
    toast.success("Account created");
    createDrawer.closeDrawer();
    accounts.reload();
  }

  async function handleUpdate(values: AccountCreate) {
    if (!editing) return;
    await api.accounts.update(editing.id, values);
    toast.success("Account updated");
    setEditing(null);
    accounts.reload();
  }

  const archiveAction = useConfirmAction(async () => {
    if (!editing) return;
    await api.accounts.archive(editing.id);
    toast.success("Account archived");
    setEditing(null);
    accounts.reload();
  });

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Chart of Account" }]} />
      <div className="page-head">
        <div>
          <h1>Chart of Accounts</h1>
          <p>The general ledger&apos;s accounts — pre-configured, rarely added to.</p>
        </div>
        {canRecord ? (
          <button type="button" className="btn btn-primary" onClick={createDrawer.openDrawer}>
            <PlusIcon size={14} />
            New account
          </button>
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
                      <td>
                        <button type="button" className="link-btn" onClick={() => setEditing(account)}>
                          {account.name}
                        </button>
                      </td>
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

      <Drawer open={createDrawer.open} onClose={createDrawer.closeDrawer} title="New account" width={35}>
        <AccountForm onSubmit={handleCreate} submitLabel="Create account" />
      </Drawer>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.code} — ${editing.name}` : "Account"}
        width={35}
        footer={
          editing && canManage && !editing.is_archived ? (
            <button type="button" className="btn btn-danger" onClick={archiveAction.request}>
              Archive
            </button>
          ) : null
        }
      >
        {editing ? (
          <>
            <StatusBadge status={editing.is_archived ? "archived" : "active"} />
            {!canManage ? (
              <div className="alert alert-info">Only an Admin can modify or archive master data.</div>
            ) : null}
            {editing.is_archived ? (
              <div className="alert alert-info">
                Archiving never touches history — postings already made to this account stay exactly
                as they were and still appear in every report covering their period.
              </div>
            ) : null}
            <AccountForm
              initial={accountToFormValues(editing)}
              onSubmit={handleUpdate}
              submitLabel="Save changes"
              readOnly={!canManage || editing.is_archived}
            />
          </>
        ) : null}
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
          editing ? (
            <p>
              {editing.code} — {editing.name} will no longer appear in pickers for new document
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
