"use client";

import { use, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { AnalyticAccountForm, analyticAccountToFormValues } from "@/components/forms/analytic-account-form";
import { api, type AnalyticAccountCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFetch } from "@/lib/use-fetch";
import { can } from "@/lib/roles";

export default function AnalyticAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const row = useFetch(() => api.analyticAccounts.get(id), [id]);
  const [archiving, setArchiving] = useState(false);
  const canManage = can.manageMasterData(user?.role.name);

  async function handleUpdate(values: AnalyticAccountCreate) {
    await api.analyticAccounts.update(id, values);
    row.reload();
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      await api.analyticAccounts.archive(id);
      row.reload();
    } finally {
      setArchiving(false);
    }
  }

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
                <button type="button" className="btn btn-danger" onClick={handleArchive} disabled={archiving}>
                  {archiving ? "Archiving…" : "Archive"}
                </button>
              ) : null}
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
          </>
        )}
      </AsyncState>
    </AppShell>
  );
}
