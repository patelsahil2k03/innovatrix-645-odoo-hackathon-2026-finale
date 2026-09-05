"use client";

import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
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

export default function VendorBillsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("-bill_date");
  const debouncedSearch = useDebouncedValue(search, 300);

  const bills = useFetch(
    () => api.vendorBills.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: sort ?? undefined }),
    [page, debouncedSearch, sort],
  );
  useEventStream({
    "document.posted": () => bills.reload(),
    "payment.registered": () => bills.reload(),
  });

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Purchase Bills</h1>
          <p>Post a bill to write it into the ledger.</p>
        </div>
        {can.record(user?.role.name) ? (
          <Link href="/purchase/bills/new" className="btn btn-primary">
            <PlusIcon size={14} />
            New bill
          </Link>
        ) : null}
      </div>

      <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} label="Search bills" placeholder="Search by number or reference" />

      <div className="card">
        <AsyncState
          loading={bills.loading}
          error={bills.error}
          data={bills.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No bills yet"
          onRetry={bills.reload}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Vendor</th>
                    <SortableTh label="Bill date" sortKey="bill_date" current={sort} onSort={setSort} />
                    <th>Due date</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "right" }}>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((bill) => (
                    <tr key={bill.id}>
                      <td><Link href={`/purchase/bills/${bill.id}`}>{bill.number}</Link></td>
                      <td>{bill.vendor_name ?? "—"}</td>
                      <td>{date(bill.bill_date)}</td>
                      <td>{date(bill.due_date)}</td>
                      <td><StatusBadge status={bill.status} /></td>
                      <td className="num">{money(bill.total)}</td>
                      <td className="num">{money(bill.amount_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>

        {bills.data ? (
          <Pagination page={bills.data.page} pages={bills.data.pages} total={bills.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>
    </AppShell>
  );
}
