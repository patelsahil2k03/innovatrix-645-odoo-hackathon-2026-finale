"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeading } from "@/components/ui/page-heading";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlusIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { date, money } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function CustomerInvoicesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("-invoice_date");
  const debouncedSearch = useDebouncedValue(search, 300);

  const invoices = useFetch(
    () => api.customerInvoices.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: sort ?? undefined }),
    [page, debouncedSearch, sort],
  );
  useEventStream({
    "document.posted": () => invoices.reload(),
    "payment.registered": () => invoices.reload(),
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Sales" }, { label: "Sale Invoice" }]} />
      <PageHeading
        image="/img/tabs/sale-invoice.webp"
        title="Sale Invoices"
        subtitle="Post an invoice to write it into the ledger."
        action={can.record(user?.role.name) ? (
          <Link href="/sales/invoices/new" className="btn btn-primary">
            <PlusIcon size={14} />
            New invoice
          </Link>
        ) : null}
      />

      <SearchInput value={search} onChange={handleSearchChange} label="Search invoices" placeholder="Search by number or reference" />

      <div className="card">
        <AsyncState
          loading={invoices.loading}
          error={invoices.error}
          data={invoices.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No invoices yet"
          onRetry={invoices.reload}
          skeleton={<SkeletonTable rows={6} columns={7} />}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Customer</th>
                    <SortableTh label="Invoice date" sortKey="invoice_date" current={sort} onSort={setSort} />
                    <th>Due date</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "right" }}>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((invoice) => (
                    <tr key={invoice.id}>
                      <td><Link href={`/sales/invoices/${invoice.id}`}>{invoice.number}</Link></td>
                      <td>{invoice.customer_name ?? "—"}</td>
                      <td>{date(invoice.invoice_date)}</td>
                      <td>{date(invoice.due_date)}</td>
                      <td><StatusBadge status={invoice.status} /></td>
                      <td className="num">{money(invoice.total)}</td>
                      <td className="num">{money(invoice.amount_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>

        {invoices.data ? (
          <Pagination page={invoices.data.page} pages={invoices.data.pages} total={invoices.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>
    </AppShell>
  );
}
