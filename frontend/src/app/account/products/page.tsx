"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { KanbanGrid } from "@/components/ui/kanban";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { ViewToggle, type ListView } from "@/components/ui/view-toggle";
import { ProductForm, productToFormValues } from "@/components/forms/product-form";
import { PlusIcon } from "@/components/icons";
import { api, type ProductCreate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useDrawerParam } from "@/lib/use-drawer-param";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { humanize, money } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsPageInner />
    </Suspense>
  );
}

function ProductsPageInner() {
  const { user } = useAuth();
  const toast = useToast();
  const panel = useDrawerParam();
  const [view, setView] = useState<ListView>("list");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("name");
  const debouncedSearch = useDebouncedValue(search, 300);

  const products = useFetch(
    () => api.products.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: sort ?? undefined }),
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
  const editingProduct = useFetch(
    () => (editingId ? api.products.get(editingId) : Promise.resolve(null)),
    [editingId],
  );

  const kanbanItems = useMemo(
    () =>
      (products.data?.items ?? []).map((product) => ({
        id: product.id,
        title: product.name,
        subtitle: product.category_name ?? humanize(product.type),
        meta: money(product.sales_price),
        imageUrl: product.image_url,
        href: panel.hrefFor(product.id),
        badge: product.is_archived ? <span className="badge badge-neutral">Archived</span> : undefined,
      })),
    [products.data, panel],
  );

  async function handleCreate(values: ProductCreate) {
    await api.products.create(values);
    toast.success("Product created");
    panel.close();
    products.reload();
  }

  async function handleUpdate(values: ProductCreate) {
    if (!editingId) return;
    await api.products.update(editingId, values);
    toast.success("Product updated");
    panel.close();
    products.reload();
  }

  const archiveAction = useConfirmAction(async () => {
    if (!editingId) return;
    await api.products.archive(editingId);
    toast.success("Product archived");
    panel.close();
    products.reload();
  });

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Product" }]} />
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p>Goods and services — Master Data.</p>
        </div>
        {canRecord ? (
          <Link href={panel.hrefFor("new")} className="btn btn-primary">
            <PlusIcon size={14} />
            New product
          </Link>
        ) : null}
      </div>

      <div className="row-between">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
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
                      <th>Category</th>
                      <SortableTh label="Sales price" sortKey="sales_price" current={sort} onSort={setSort} align="right" />
                      <SortableTh label="Cost price" sortKey="cost_price" current={sort} onSort={setSort} align="right" />
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.items.map((product) => (
                      <tr key={product.id}>
                        <td><Link href={panel.hrefFor(product.id)}>{product.name}</Link></td>
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
              <KanbanGrid items={kanbanItems} />
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

      <Drawer open={panel.isNew} onClose={panel.close} title="New product">
        <ProductForm onSubmit={handleCreate} submitLabel="Create product" />
      </Drawer>

      <Drawer
        open={panel.openId !== null}
        onClose={panel.close}
        title={editingProduct.data?.name ?? "Product"}
       
        footer={
          editingProduct.data && canManage && !editingProduct.data.is_archived ? (
            <button type="button" className="btn btn-danger" onClick={archiveAction.request}>
              Archive
            </button>
          ) : null
        }
      >
        <AsyncState
          loading={editingProduct.loading}
          error={editingProduct.error}
          data={editingProduct.data}
          onRetry={editingProduct.reload}
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
              <ProductForm
                initial={productToFormValues(data)}
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
        title="Archive this product?"
        confirmLabel="Archive product"
        pendingLabel="Archiving…"
        description={
          editingProduct.data ? (
            <p>
              {editingProduct.data.name} will no longer appear in active lists or pickers on new documents.
              Existing sales and purchase lines for this product are untouched, but there is
              no way to unarchive it from the app yet.
            </p>
          ) : null
        }
      />
    </AppShell>
  );
}
