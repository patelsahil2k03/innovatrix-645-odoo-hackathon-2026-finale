"use client";

import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { KanbanGrid } from "@/components/ui/kanban";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { ViewToggle, type ListView } from "@/components/ui/view-toggle";
import { PlusIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useFetch } from "@/lib/use-fetch";
import { humanize, money } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const { user } = useAuth();
  const [view, setView] = useState<ListView>("list");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("name");
  const debouncedSearch = useDebouncedValue(search, 300);

  const products = useFetch(
    () => api.products.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: sort ?? undefined }),
    [page, debouncedSearch, sort],
  );

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p>Goods and services — Master Data.</p>
        </div>
        {can.record(user?.role.name) ? (
          <Link href="/account/products/new" className="btn btn-primary">
            <PlusIcon size={14} />
            New product
          </Link>
        ) : null}
      </div>

      <div className="row-between">
        <SearchInput
          value={search}
          onChange={(value) => { setSearch(value); setPage(1); }}
          label="Search products"
          placeholder="Search by name or category"
        />
        <ViewToggle value={view} onChange={setView} />
      </div>

      <div className="card">
        <AsyncState
          loading={products.loading}
          error={products.error}
          data={products.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No products yet"
          emptyHint="Create your first product to start building orders and invoices."
          onRetry={products.reload}
        >
          {(pageData) =>
            view === "list" ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortableTh label="Name" sortKey="name" current={sort} onSort={setSort} />
                      <th>Type</th>
                      <th>Category</th>
                      <SortableTh label="Sales price" sortKey="sales_price" current={sort} onSort={setSort} align="right" />
                      <SortableTh label="Cost price" sortKey="cost_price" current={sort} onSort={setSort} align="right" />
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.items.map((product) => (
                      <tr key={product.id}>
                        <td><Link href={`/account/products/${product.id}`}>{product.name}</Link></td>
                        <td>{humanize(product.type)}</td>
                        <td>{product.category_name ?? "—"}</td>
                        <td className="num">{money(product.sales_price)}</td>
                        <td className="num">{money(product.cost_price)}</td>
                        <td>{product.is_archived ? <StatusBadge status="archived" /> : <StatusBadge status="active" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <KanbanGrid
                items={pageData.items.map((product) => ({
                  id: product.id,
                  title: product.name,
                  subtitle: product.category_name ?? humanize(product.type),
                  meta: money(product.sales_price),
                  imageUrl: product.image_url,
                  href: `/account/products/${product.id}`,
                  badge: product.is_archived ? <span className="badge badge-neutral">Archived</span> : undefined,
                }))}
              />
            )
          }
        </AsyncState>

        {products.data ? (
          <Pagination
            page={products.data.page}
            pages={products.data.pages}
            total={products.data.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
