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
import { PlusIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { date, money } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function ReceiptsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const receipts = useFetch(
    () => api.payments.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, direction: "RECEIVE", sort: "-payment_date" }),
    [page, debouncedSearch],
  );
  useEventStream({ "payment.registered": () => receipts.reload() });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Sales" }, { label: "Receipt" }]} />
      <PageHeading
        image="/img/tabs/receipt.webp"
        title="Receipts"
        subtitle="Payments received against sale invoices."
        action={can.record(user?.role.name) ? (
          <Link href="/sales/receipts/new" className="btn btn-primary">
            <PlusIcon size={14} />
            New receipt
          </Link>
        ) : null}
      />

      <SearchInput value={search} onChange={handleSearchChange} label="Search receipts" />

      <div className="card">
        <AsyncState
          loading={receipts.loading}
          error={receipts.error}
          data={receipts.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No receipts yet"
          onRetry={receipts.reload}
          skeleton={<SkeletonTable rows={6} columns={6} />}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Number</th><th>Customer</th><th>Journal</th><th>Date</th><th>Note</th><th style={{ textAlign: "right" }}>Amount</th></tr>
                </thead>
                <tbody>
                  {pageData.items.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.number}</td>
                      <td>{payment.contact_name ?? "—"}</td>
                      <td>{payment.journal_name ?? "—"}</td>
                      <td>{date(payment.payment_date)}</td>
                      <td>{payment.note ?? "—"}</td>
                      <td className="num">{money(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>

        {receipts.data ? (
          <Pagination page={receipts.data.page} pages={receipts.data.pages} total={receipts.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>
    </AppShell>
  );
}
