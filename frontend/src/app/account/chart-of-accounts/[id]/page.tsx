"use client";

import { use } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { AccountForm, accountToFormValues } from "@/components/forms/account-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type AccountCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { can } from "@/lib/roles";

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const toast = useToast();
  const account = useFetch(() => api.accounts.get(id), [id]);
  const canManage = can.manageMasterData(user?.role.name);

  async function handleUpdate(values: AccountCreate) {
    await api.accounts.update(id, values);
    account.reload();
  }

  const archiveAction = useConfirmAction(async () => {
    await api.accounts.archive(id);
    account.reload();
    toast.success("Account archived");
  });

  return (
    <AppShell>
      <AsyncState loading={account.loading} error={account.error} data={account.data} onRetry={account.reload}>
        {(data) => (
          <>
            <div className="page-head">
              <div>
                <h1>{data.code} — {data.name}</h1>
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
                <p>
                  {data.code} — {data.name} will no longer appear in pickers for new document
                  lines. Postings already made to it stay exactly as they are and still appear
                  in every report covering their period, but there is no way to unarchive it
                  from the app yet.
                </p>
              }
            />
          </>
        )}
      </AsyncState>
    </AppShell>
  );
}
