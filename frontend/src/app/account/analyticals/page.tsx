"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { KanbanGrid } from "@/components/ui/kanban";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { ViewToggle, type ListView } from "@/components/ui/view-toggle";
import { AnalyticAccountForm, analyticAccountToFormValues } from "@/components/forms/analytic-account-form";
import { PlusIcon } from "@/components/icons";
import { api, type AnalyticAccountCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useDrawerParam } from "@/lib/use-drawer-param";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { humanize } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function AnalyticAccountsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticAccountsPageInner />
    </Suspense>
  );
}

function AnalyticAccountsPageInner() {
  const { user } = useAuth();
  const toast = useToast();
  const panel = useDrawerParam();
  const [view, setView] = useState<ListView>("list");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const rows = useFetch(
    () => api.analyticAccounts.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: "name" }),
    [page, debouncedSearch],
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
  const editingRow = useFetch(
    () => (editingId ? api.analyticAccounts.get(editingId) : Promise.resolve(null)),
    [editingId],
  );

  const kanbanItems = useMemo(
    () =>
      (rows.data?.items ?? []).map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: humanize(row.type),
        href: panel.hrefFor(row.id),
        badge: row.is_archived ? <span className="badge badge-neutral">Archived</span> : undefined,
      })),
    [rows.data, panel],
  );

  async function handleCreate(values: AnalyticAccountCreate) {
    await api.analyticAccounts.create(values);
    toast.success("Analytic account created");
    panel.close();
    rows.reload();
  }

  async function handleUpdate(values: AnalyticAccountCreate) {
    if (!editingId) return;
    await api.analyticAccounts.update(editingId, values);
    toast.success("Analytic account updated");
    panel.close();
    rows.reload();
  }

  const archiveAction = useConfirmAction(async () => {
    if (!editingId) return;
    await api.analyticAccounts.archive(editingId);
    toast.success("Analytic account archived");
    panel.close();
    rows.reload();
  });

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Analyticals" }]} />
      <div className="page-head">
        <div>
          <h1>Analyticals</h1>
          <p>Analytic accounts — the tags that measure a budget without touching the Chart of Accounts.</p>
        </div>
        {canRecord ? (
          <Link href={panel.hrefFor("new")} className="btn btn-primary">
            <PlusIcon size={14} />
            New analytic account
          </Link>
        ) : null}
      </div>

      <div className="row-between">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
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
          skeleton={<SkeletonTable rows={6} columns={3} />}
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
                        <td><Link href={panel.hrefFor(row.id)}>{row.name}</Link></td>
                        <td>{humanize(row.type)}</td>
                        <td>{row.is_archived ? <StatusBadge status="archived" /> : <StatusBadge status="active" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <KanbanGrid items={kanbanItems} />
            )
          }
        </AsyncState>

        {rows.data ? (
          <Pagination page={rows.data.page} pages={rows.data.pages} total={rows.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>

      <Drawer open={panel.isNew} onClose={panel.close} title="New analytic account" width={35}>
        <AnalyticAccountForm onSubmit={handleCreate} submitLabel="Create analytic account" />
      </Drawer>

      <Drawer
        open={panel.openId !== null}
        onClose={panel.close}
        title={editingRow.data?.name ?? "Analytic account"}
        width={35}
        footer={
          editingRow.data && canManage && !editingRow.data.is_archived ? (
            <button type="button" className="btn btn-danger" onClick={archiveAction.request}>
              Archive
            </button>
          ) : null
        }
      >
        <AsyncState
          loading={editingRow.loading}
          error={editingRow.error}
          data={editingRow.data}
          onRetry={editingRow.reload}
          skeleton={<SkeletonCard lines={4} />}
        >
          {(data) => (
            <>
              <StatusBadge status={data.is_archived ? "archived" : "active"} />
              {!canManage ? (
                <div className="alert alert-info">Only an Admin can modify or archive master data.</div>
              ) : null}
              <AnalyticAccountForm
                initial={analyticAccountToFormValues(data)}
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
        title="Archive this analytic account?"
        confirmLabel="Archive analytic account"
        pendingLabel="Archiving…"
        description={
          editingRow.data ? (
            <p>
              {editingRow.data.name} will no longer appear in pickers on new document lines. Existing
              postings already tagged with it are untouched, but there is no way to
              unarchive it from the app yet.
            </p>
          ) : null
        }
      />
    </AppShell>
  );
}
