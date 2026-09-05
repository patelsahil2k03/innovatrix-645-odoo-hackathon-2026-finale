"use client";

import { use, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { JournalForm, journalToFormValues } from "@/components/forms/journal-form";
import { api, type JournalCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFetch } from "@/lib/use-fetch";
import { can } from "@/lib/roles";

export default function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const journal = useFetch(() => api.journals.get(id), [id]);
  const [archiving, setArchiving] = useState(false);
  const canManage = can.manageMasterData(user?.role.name);

  async function handleUpdate(values: JournalCreate) {
    await api.journals.update(id, values);
    journal.reload();
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      await api.journals.archive(id);
      journal.reload();
    } finally {
      setArchiving(false);
    }
  }

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
                <button type="button" className="btn btn-danger" onClick={handleArchive} disabled={archiving}>
                  {archiving ? "Archiving…" : "Archive"}
                </button>
              ) : null}
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
          </>
        )}
      </AsyncState>
    </AppShell>
  );
}
