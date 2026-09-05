"use client";

import { use, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { AccountForm, accountToFormValues } from "@/components/forms/account-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type AccountCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFetch } from "@/lib/use-fetch";
import { can } from "@/lib/roles";

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const account = useFetch(() => api.accounts.get(id), [id]);
  const [archiving, setArchiving] = useState(false);
  const canManage = can.manageMasterData(user?.role.name);

  async function handleUpdate(values: AccountCreate) {
    await api.accounts.update(id, values);
    account.reload();
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      await api.accounts.archive(id);
      account.reload();
    } finally {
      setArchiving(false);
    }
  }

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
                <button type="button" className="btn btn-danger" onClick={handleArchive} disabled={archiving}>
                  {archiving ? "Archiving…" : "Archive"}
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
          </>
        )}
      </AsyncState>
    </AppShell>
  );
}
