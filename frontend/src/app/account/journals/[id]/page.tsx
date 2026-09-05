"use client";

import { use } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { JournalForm, journalToFormValues } from "@/components/forms/journal-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type JournalCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { can } from "@/lib/roles";

export default function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const toast = useToast();
  const journal = useFetch(() => api.journals.get(id), [id]);
  const canManage = can.manageMasterData(user?.role.name);

  async function handleUpdate(values: JournalCreate) {
    await api.journals.update(id, values);
    journal.reload();
  }

  const archiveAction = useConfirmAction(async () => {
    await api.journals.archive(id);
    journal.reload();
    toast.success("Journal archived");
  });

  return (
    <AppShell>
      <AsyncState loading={journal.loading} error={journal.error} data={journal.data} onRetry={journal.reload}>
        {(data) => (
          <>
            <div className="page-head">
              <div>
                <h1>{data.name}</h1>
                <p>{data.is_archived ? <StatusBadge status="archived" /> : <StatusBadge status="active" />}</p>
              </div>
              {canManage && !data.is_archived ? (
                <button type="button" className="btn btn-danger" onClick={archiveAction.request}>
                  Archive
                </button>
              ) : null}
              <ClosePanel />
            </div>
            {!canManage ? (
              <div className="alert alert-info">Only an Admin can modify or archive master data.</div>
            ) : null}
            <JournalForm
              initial={journalToFormValues(data)}
              onSubmit={handleUpdate}
              submitLabel="Save changes"
              readOnly={!canManage || data.is_archived}
            />

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
                <p>
                  {data.name} will no longer appear in pickers for new documents. Journal
                  entries already posted through it are untouched, but there is no way to
                  unarchive it from the app yet.
                </p>
              }
            />
          </>
        )}
      </AsyncState>
    </AppShell>
  );
}
