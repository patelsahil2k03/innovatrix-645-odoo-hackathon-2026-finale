"use client";

import { use } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContactForm, contactToFormValues } from "@/components/forms/contact-form";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type ContactCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { can } from "@/lib/roles";

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const toast = useToast();
  const contact = useFetch(() => api.contacts.get(id), [id]);

  const canManage = can.manageMasterData(user?.role.name);

  async function handleUpdate(values: ContactCreate) {
    await api.contacts.update(id, values);
    contact.reload();
  }

  const archiveAction = useConfirmAction(async () => {
    await api.contacts.archive(id);
    contact.reload();
    toast.success("Contact archived");
  });

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
                <button type="button" className="btn btn-danger" onClick={archiveAction.request}>
                  Archive
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

            <ConfirmDialog
              open={archiveAction.open}
              onCancel={archiveAction.cancel}
              onConfirm={archiveAction.confirm}
              pending={archiveAction.pending}
              error={archiveAction.error}
              tone="danger"
              title="Archive this contact?"
              confirmLabel="Archive contact"
              pendingLabel="Archiving…"
              description={
                <p>
                  {data.name} will no longer appear in active lists or pickers on new documents.
                  Existing invoices, bills and orders for this contact are untouched, but there
                  is no way to unarchive it from the app yet.
                </p>
              }
            />
          </>
        )}
      </AsyncState>
    </AppShell>
  );
}
