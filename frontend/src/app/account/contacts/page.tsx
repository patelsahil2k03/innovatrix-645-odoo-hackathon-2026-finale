"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { KanbanGrid } from "@/components/ui/kanban";
import { PageHeading } from "@/components/ui/page-heading";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { ViewToggle, type ListView } from "@/components/ui/view-toggle";
import { ContactForm, contactToFormValues } from "@/components/forms/contact-form";
import { PlusIcon } from "@/components/icons";
import { api, type ContactCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useDrawerParam } from "@/lib/use-drawer-param";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { humanize } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function ContactsPage() {
  return (
    <Suspense fallback={null}>
      <ContactsPageInner />
    </Suspense>
  );
}

function ContactsPageInner() {
  const { user } = useAuth();
  const toast = useToast();
  const panel = useDrawerParam();
  const [view, setView] = useState<ListView>("list");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("name");
  const debouncedSearch = useDebouncedValue(search, 300);

  const contacts = useFetch(
    () => api.contacts.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: sort ?? undefined }),
    [page, debouncedSearch, sort],
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
  const editingContact = useFetch(
    () => (editingId ? api.contacts.get(editingId) : Promise.resolve(null)),
    [editingId],
  );

  const kanbanItems = useMemo(
    () =>
      (contacts.data?.items ?? []).map((contact) => ({
        id: contact.id,
        title: contact.name,
        subtitle: contact.email ?? contact.mobile ?? undefined,
        meta: humanize(contact.type),
        imageUrl: contact.image_url,
        href: panel.hrefFor(contact.id),
        badge: contact.is_archived ? <span className="badge badge-neutral">Archived</span> : undefined,
      })),
    [contacts.data, panel],
  );

  async function handleCreate(values: ContactCreate) {
    await api.contacts.create(values);
    toast.success("Contact created");
    panel.close();
    contacts.reload();
  }

  async function handleUpdate(values: ContactCreate) {
    if (!editingId) return;
    await api.contacts.update(editingId, values);
    toast.success("Contact updated");
    panel.close();
    contacts.reload();
  }

  const archiveAction = useConfirmAction(async () => {
    if (!editingId) return;
    await api.contacts.archive(editingId);
    toast.success("Contact archived");
    panel.close();
    contacts.reload();
  });

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Contact" }]} />
      <PageHeading
        image="/img/tabs/contact.webp"
        title="Contacts"
        subtitle="Customers and vendors — Master Data."
        action={
          canRecord ? (
            <Link href={panel.hrefFor("new")} className="btn btn-primary">
              <PlusIcon size={14} />
              New contact
            </Link>
          ) : null
        }
      />

      <div className="row-between">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          label="Search contacts"
          placeholder="Search by name, email or mobile"
        />
        <ViewToggle value={view} onChange={setView} />
      </div>

      <div className="card">
        <AsyncState
          loading={contacts.loading}
          error={contacts.error}
          data={contacts.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No contacts yet"
          emptyHint="Create your first customer or vendor to get started."
          onRetry={contacts.reload}
          skeleton={<SkeletonTable rows={6} columns={6} />}
        >
          {(pageData) =>
            view === "list" ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortableTh label="Name" sortKey="name" current={sort} onSort={setSort} />
                      <th>Type</th>
                      <th>Email</th>
                      <th>Mobile</th>
                      <th>City</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.items.map((contact) => (
                      <tr key={contact.id}>
                        <td><Link href={panel.hrefFor(contact.id)}>{contact.name}</Link></td>
                        <td>{humanize(contact.type)}</td>
                        <td>{contact.email ?? "—"}</td>
                        <td>{contact.mobile ?? "—"}</td>
                        <td>{contact.address_city ?? "—"}</td>
                        <td>{contact.is_archived ? <StatusBadge status="archived" /> : <StatusBadge status="active" />}</td>
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

        {contacts.data ? (
          <Pagination
            page={contacts.data.page}
            pages={contacts.data.pages}
            total={contacts.data.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        ) : null}
      </div>

      <Drawer open={panel.isNew} onClose={panel.close} title="New contact">
        <ContactForm onSubmit={handleCreate} submitLabel="Create contact" />
      </Drawer>

      <Drawer
        open={panel.openId !== null}
        onClose={panel.close}
        title={editingContact.data?.name ?? "Contact"}
       
        footer={
          editingContact.data && canManage && !editingContact.data.is_archived ? (
            <button type="button" className="btn btn-danger" onClick={archiveAction.request}>
              Archive
            </button>
          ) : null
        }
      >
        <AsyncState
          loading={editingContact.loading}
          error={editingContact.error}
          data={editingContact.data}
          onRetry={editingContact.reload}
          skeleton={<SkeletonCard lines={4} />}
        >
          {(data) => (
            <>
              <StatusBadge status={data.is_archived ? "archived" : "active"} />
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
      </Drawer>

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
          editingContact.data ? (
            <p>
              {editingContact.data.name} will no longer appear in active lists or pickers on new documents.
              Existing invoices, bills and orders for this contact are untouched, but there
              is no way to unarchive it from the app yet.
            </p>
          ) : null
        }
      />
    </AppShell>
  );
}
