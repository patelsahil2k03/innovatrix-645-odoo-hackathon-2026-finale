"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { KanbanGrid } from "@/components/ui/kanban";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { ViewToggle, type ListView } from "@/components/ui/view-toggle";
import { PlusIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useFetch } from "@/lib/use-fetch";
import { humanize } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function ContactsPage() {
  const { user } = useAuth();
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

  const kanbanItems = useMemo(
    () =>
      (contacts.data?.items ?? []).map((contact) => ({
        id: contact.id,
        title: contact.name,
        subtitle: contact.email ?? contact.mobile ?? undefined,
        meta: humanize(contact.type),
        imageUrl: contact.image_url,
        href: `/account/contacts/${contact.id}`,
        badge: contact.is_archived ? <span className="badge badge-neutral">Archived</span> : undefined,
      })),
    [contacts.data],
  );

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Contact" }]} />
      <div className="page-head">
        <div>
          <h1>Contacts</h1>
          <p>Customers and vendors — Master Data.</p>
        </div>
        {can.record(user?.role.name) ? (
          <Link href="/account/contacts/new" className="btn btn-primary">
            <PlusIcon size={14} />
            New contact
          </Link>
        ) : null}
      </div>

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
                        <td><Link href={`/account/contacts/${contact.id}`}>{contact.name}</Link></td>
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
    </AppShell>
  );
}
