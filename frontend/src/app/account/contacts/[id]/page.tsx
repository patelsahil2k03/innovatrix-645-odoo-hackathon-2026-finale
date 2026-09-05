"use client";

import { use, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContactForm, contactToFormValues } from "@/components/forms/contact-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type ContactCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFetch } from "@/lib/use-fetch";
import { can } from "@/lib/roles";

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const contact = useFetch(() => api.contacts.get(id), [id]);
  const [archiving, setArchiving] = useState(false);

  const canManage = can.manageMasterData(user?.role.name);

  async function handleUpdate(values: ContactCreate) {
    await api.contacts.update(id, values);
    contact.reload();
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      await api.contacts.archive(id);
      contact.reload();
    } finally {
      setArchiving(false);
    }
  }

  return (
    <AppShell>
      <AsyncState
        loading={contact.loading}
        error={contact.error}
        data={contact.data}
        onRetry={contact.reload}
      >
        {(data) => (
          <>
            <div className="page-head">
              <div>
                <h1>{data.name}</h1>
                <p>
                  {data.is_archived ? <StatusBadge status="archived" /> : <StatusBadge status="active" />}
                </p>
              </div>
              {canManage && !data.is_archived ? (
                <button type="button" className="btn btn-danger" onClick={handleArchive} disabled={archiving}>
                  {archiving ? "Archiving…" : "Archive"}
                </button>
              ) : null}
              <ClosePanel />
            </div>

            {!canManage ? (
              <div className="alert alert-info">
                Only an Admin can modify or archive master data — you can view this record.
              </div>
            ) : null}

            <ContactForm
              initial={contactToFormValues(data)}
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
