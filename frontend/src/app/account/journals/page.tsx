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
import { StatusBadge } from "@/components/ui/status-badge";
import { JournalForm, journalToFormValues } from "@/components/forms/journal-form";
import { PlusIcon } from "@/components/icons";
import { api, type JournalCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useDrawerParam } from "@/lib/use-drawer-param";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { humanize } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function JournalsPage() {
  return (
    <Suspense fallback={null}>
      <JournalsPageInner />
    </Suspense>
  );
}

function JournalsPageInner() {
  const { user } = useAuth();
  const toast = useToast();
  const panel = useDrawerParam();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const journals = useFetch(
    () => api.journals.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: "name" }),
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
  const editingJournal = useFetch(
    () => (editingId ? api.journals.get(editingId) : Promise.resolve(null)),
    [editingId],
  );

  async function handleCreate(values: JournalCreate) {
    await api.journals.create(values);
    toast.success("Journal created");
    panel.close();
    journals.reload();
  }

  async function handleUpdate(values: JournalCreate) {
    if (!editingId) return;
    await api.journals.update(editingId, values);
    toast.success("Journal updated");
    panel.close();
    journals.reload();
  }

  const archiveAction = useConfirmAction(async () => {
    if (!editingId) return;
    await api.journals.archive(editingId);
    toast.success("Journal archived");
    panel.close();
    journals.reload();
  });

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Journals" }]} />
      <PageHeading
        image="/img/tabs/journals.webp"
        title="Journals"
        subtitle="Where a payment posts — Bank, Cash, Sales, Purchase, Misc."
        action={
          canRecord ? (
            <Link href={panel.hrefFor("new")} className="btn btn-primary">
              <PlusIcon size={14} />
              New journal
            </Link>
          ) : null
        }
      />

      <SearchInput value={search} onChange={handleSearchChange} label="Search journals" />

      <div className="card">
        <AsyncState
          loading={journals.loading}
          error={journals.error}
          data={journals.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No journals yet"
          onRetry={journals.reload}
          skeleton={<SkeletonTable rows={6} columns={3} />}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Type</th><th>Status</th></tr></thead>
                <tbody>
                  {pageData.items.map((journal) => (
                    <tr key={journal.id}>
                      <td><Link href={panel.hrefFor(journal.id)}>{journal.name}</Link></td>
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

      <Drawer open={panel.isNew} onClose={panel.close} title="New journal">
        <JournalForm onSubmit={handleCreate} submitLabel="Create journal" />
      </Drawer>

      <Drawer
        open={panel.openId !== null}
        onClose={panel.close}
        title={editingJournal.data?.name ?? "Journal"}
       
        footer={
          editingJournal.data && canManage && !editingJournal.data.is_archived ? (
            <button type="button" className="btn btn-danger" onClick={archiveAction.request}>
              Archive
            </button>
          ) : null
        }
      >
        <AsyncState
          loading={editingJournal.loading}
          error={editingJournal.error}
          data={editingJournal.data}
          onRetry={editingJournal.reload}
          skeleton={<SkeletonCard lines={4} />}
        >
          {(data) => (
            <>
              <StatusBadge status={data.is_archived ? "archived" : "active"} />
              {!canManage ? (
                <div className="alert alert-info">Only an Admin can modify or archive master data.</div>
              ) : null}
              <JournalForm
                initial={journalToFormValues(data)}
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
        title="Archive this journal?"
        confirmLabel="Archive journal"
        pendingLabel="Archiving…"
        description={
          editingJournal.data ? (
            <p>
              {editingJournal.data.name} will no longer appear in pickers for new documents. Journal
              entries already posted through it are untouched, but there is no way to
              unarchive it from the app yet.
            </p>
          ) : null
        }
      />
    </AppShell>
  );
}
