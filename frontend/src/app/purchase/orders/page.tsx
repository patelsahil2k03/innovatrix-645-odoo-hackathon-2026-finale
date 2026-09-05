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

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("-order_date");
  const debouncedSearch = useDebouncedValue(search, 300);

  const orders = useFetch(
    () => api.purchaseOrders.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: sort ?? undefined }),
    [page, debouncedSearch, sort],
  );
  useEventStream({ "document.posted": () => orders.reload() });

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Purchase Orders</h1>
          <p>Confirm an order, then create the bill from it — or raise a bill fresh.</p>
        </div>
        {can.record(user?.role.name) ? (
          <Link href="/purchase/orders/new" className="btn btn-primary">
            <PlusIcon size={14} />
            New purchase order
          </Link>
        ) : null}
      </div>

      <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} label="Search purchase orders" placeholder="Search by number or reference" />

      <div className="card">
        <AsyncState
          loading={orders.loading}
          error={orders.error}
          data={orders.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No purchase orders yet"
          onRetry={orders.reload}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Vendor</th>
                    <SortableTh label="Order date" sortKey="order_date" current={sort} onSort={setSort} />
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((order) => (
                    <tr key={order.id}>
                      <td><Link href={`/purchase/orders/${order.id}`}>{order.number}</Link></td>
                      <td>{order.vendor_name ?? "—"}</td>
                      <td>{date(order.order_date)}</td>
                      <td><StatusBadge status={order.status} /></td>
                      <td className="num">{money(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>

        {orders.data ? (
          <Pagination page={orders.data.page} pages={orders.data.pages} total={orders.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>
    </AppShell>
  );
}
