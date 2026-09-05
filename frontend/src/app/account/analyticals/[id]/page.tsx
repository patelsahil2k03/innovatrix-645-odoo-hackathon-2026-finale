"use client";

import { use } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { AnalyticAccountForm, analyticAccountToFormValues } from "@/components/forms/analytic-account-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type AnalyticAccountCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { can } from "@/lib/roles";

export default function AnalyticAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const toast = useToast();
  const row = useFetch(() => api.analyticAccounts.get(id), [id]);
  const canManage = can.manageMasterData(user?.role.name);

  async function handleUpdate(values: AnalyticAccountCreate) {
    await api.analyticAccounts.update(id, values);
    row.reload();
  }

  const archiveAction = useConfirmAction(async () => {
    await api.analyticAccounts.archive(id);
    row.reload();
    toast.success("Analytic account archived");
  });

  return (
    <AppShell>
      <AsyncState loading={row.loading} error={row.error} data={row.data} onRetry={row.reload}>
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
            <AnalyticAccountForm
              initial={analyticAccountToFormValues(data)}
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
              title="Archive this analytic account?"
              confirmLabel="Archive analytic account"
              pendingLabel="Archiving…"
              description={
                <p>
                  {data.name} will no longer appear in pickers on new document lines. Existing
                  postings already tagged with it are untouched, but there is no way to
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
