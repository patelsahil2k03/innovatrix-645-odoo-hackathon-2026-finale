"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
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

export default function PurchasePaymentsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const payments = useFetch(
    () => api.payments.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, direction: "SEND", sort: "-payment_date" }),
    [page, debouncedSearch],
  );
  useEventStream({ "payment.registered": () => payments.reload() });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Purchase" }, { label: "Payment" }]} />
      <div className="page-head">
        <div>
          <h1>Payments</h1>
          <p>Payments sent against vendor bills.</p>
        </div>
        {can.record(user?.role.name) ? (
          <Link href="/purchase/payments/new" className="btn btn-primary">
            <PlusIcon size={14} />
            New payment
          </Link>
        ) : null}
      </div>

      <SearchInput value={search} onChange={handleSearchChange} label="Search payments" />

      <div className="card">
        <AsyncState
          loading={payments.loading}
          error={payments.error}
          data={payments.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No payments yet"
          onRetry={payments.reload}
          skeleton={<SkeletonTable rows={6} columns={6} />}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Number</th><th>Vendor</th><th>Journal</th><th>Date</th><th>Note</th><th style={{ textAlign: "right" }}>Amount</th></tr>
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

        {payments.data ? (
          <Pagination page={payments.data.page} pages={payments.data.pages} total={payments.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>
    </AppShell>
  );
}
