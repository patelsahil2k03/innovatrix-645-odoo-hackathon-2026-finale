"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { Field } from "@/components/ui/field";
import { LineItemsEditor } from "@/components/ui/line-items-editor";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlusIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { lineDefaultsFromProduct, useDocumentLines } from "@/lib/use-document-lines";
import { useDrawerParam } from "@/lib/use-drawer-param";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { documentLinesSchema, fieldErrorsFrom, formMessageFrom, required, validate } from "@/lib/validation";
import { date, money } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={null}>
      <PurchaseOrdersPageInner />
    </Suspense>
  );
}

function PurchaseOrdersPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const panel = useDrawerParam();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("-order_date");
  const debouncedSearch = useDebouncedValue(search, 300);

  const orders = useFetch(
    () => api.purchaseOrders.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: sort ?? undefined }),
    [page, debouncedSearch, sort],
  );
  useEventStream({ "document.posted": () => orders.reload() }, !!user);

  const canRecord = can.record(user?.role.name);

  const contacts = useFetch(() => api.contacts.list({ page_size: 100, sort: "name" }), []);
  const products = useFetch(() => api.products.list({ page_size: 100, sort: "name" }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 100, sort: "name" }), []);
  const vendors = (contacts.data?.items ?? []).filter((c) => c.type === "VENDOR" || c.type === "BOTH");

  // Fetched by id rather than read off the currently loaded page, so
  // `?open=<id>` stays a real, reloadable link regardless of search/sort/page.
  const editingId = panel.openId;
  const editingOrder = useFetch(
    () => (editingId ? api.purchaseOrders.get(editingId) : Promise.resolve(null)),
    [editingId],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  // ── Create drawer ────────────────────────────────────────────────────────
  const [reference, setReference] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { lines, addLine, removeLine, updateLine, selectProduct, totals, reset: resetLines } = useDocumentLines();

  function resetCreateForm() {
    setReference("");
    setVendorId("");
    setOrderDate(new Date().toISOString().slice(0, 10));
    setFormError(null);
    setVendorError(null);
    resetLines();
  }

  async function handleCreateSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const vendorResult = validate(required("Vendor"), vendorId);
    const linesResult = validate(documentLinesSchema, lines);
    if (!vendorResult.ok) {
      setVendorError("Vendor is required");
      return;
    }
    setVendorError(null);
    if (!linesResult.ok) {
      setFormError("Fix the highlighted lines before saving.");
      return;
    }

    setSubmitting(true);
    try {
      await api.purchaseOrders.create({
        reference: reference || null,
        vendor_id: vendorId,
        order_date: orderDate,
        lines: linesResult.data,
      });
      toast.success("Purchase order created");
      resetCreateForm();
      panel.close();
      orders.reload();
    } catch (error) {
      setFormError(formMessageFrom(error));
      const fields = fieldErrorsFrom(error);
      if (fields.vendor_id) setVendorError(fields.vendor_id);
    } finally {
      setSubmitting(false);
    }
  }

  // ── View drawer — lifecycle actions ─────────────────────────────────────
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!editingId) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.purchaseOrders.confirm(editingId);
      editingOrder.reload();
      orders.reload();
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleCreateBill() {
    if (!editingId) return;
    setWorking(true);
    setActionError(null);
    try {
      const bill = await api.purchaseOrders.createBill(editingId);
      panel.close();
      router.push(`/purchase/bills?open=${bill.id}`);
    } catch (error) {
      setActionError(formMessageFrom(error));
      setWorking(false);
    }
  }

  const cancelAction = useConfirmAction(async () => {
    if (!editingId) return;
    await api.purchaseOrders.cancel(editingId);
    editingOrder.reload();
    orders.reload();
    toast.success("Purchase order cancelled");
  });

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Purchase" }, { label: "Purchase Order" }]} />
      <div className="page-head">
        <div>
          <h1>Purchase Orders</h1>
          <p>Confirm an order, then create the bill from it — or raise a bill fresh.</p>
        </div>
        {canRecord ? (
          <Link href={panel.hrefFor("new")} className="btn btn-primary">
            <PlusIcon size={14} />
            New purchase order
          </Link>
        ) : null}
      </div>

      <SearchInput value={search} onChange={handleSearchChange} label="Search purchase orders" placeholder="Search by number or reference" />

      <div className="card">
        <AsyncState
          loading={orders.loading}
          error={orders.error}
          data={orders.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No purchase orders yet"
          onRetry={orders.reload}
          skeleton={<SkeletonTable rows={6} columns={5} />}
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
                      <td><Link href={panel.hrefFor(order.id)}>{order.number}</Link></td>
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

      <Drawer
        open={panel.isNew}
        onClose={() => { resetCreateForm(); panel.close(); }}
        title="New purchase order"
        width={60}
        footer={
          <button type="submit" form="new-purchase-order-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save purchase order"}
          </button>
        }
      >
        <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          Nothing posts to the ledger until this becomes a bill and that bill is posted.
        </p>
        <form id="new-purchase-order-form" className="stack" onSubmit={handleCreateSubmit} noValidate>
          {formError ? <div className="alert alert-danger" role="alert">{formError}</div> : null}

          <div className="card grid-2">
            <Field label="Vendor" error={vendorError ?? undefined} required>
              {(props) => (
                <select {...props} className="select" value={vendorId} onChange={(event) => setVendorId(event.target.value)}>
                  <option value="">Select a vendor…</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Order date" required>
              {(props) => (
                <input {...props} className="input" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
              )}
            </Field>
            <Field label="Reference" hint="Your own reference for this order">
              {(props) => (
                <input {...props} className="input" value={reference} onChange={(event) => setReference(event.target.value)} />
              )}
            </Field>
          </div>

          <div className="card">
            <div className="card-head"><span className="card-title">Order lines</span></div>
            <LineItemsEditor
              lines={lines}
              products={products.data?.items ?? []}
              analyticAccounts={analyticAccounts.data?.items ?? []}
              onAdd={addLine}
              onRemove={removeLine}
              onUpdate={updateLine}
              onSelectProduct={(key, productId) => {
                const product = products.data?.items.find((p) => p.id === productId);
                selectProduct(key, productId, product ? lineDefaultsFromProduct(product, "purchase") : {});
              }}
              totals={totals}
            />
          </div>
        </form>
      </Drawer>

      <Drawer
        open={panel.openId !== null}
        onClose={panel.close}
        title={editingOrder.data?.number ?? "Purchase order"}
        width={60}
        footer={
          editingOrder.data && canRecord ? (
            <>
              {editingOrder.data.status === "DRAFT" ? (
                <button type="button" className="btn" onClick={cancelAction.request} disabled={working}>Cancel</button>
              ) : null}
              {editingOrder.data.status === "DRAFT" ? (
                <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={working}>Confirm</button>
              ) : null}
              {editingOrder.data.status === "CONFIRMED" ? (
                <button type="button" className="btn btn-primary" onClick={handleCreateBill} disabled={working}>Create bill</button>
              ) : null}
            </>
          ) : null
        }
      >
        <AsyncState
          loading={editingOrder.loading}
          error={editingOrder.error}
          data={editingOrder.data}
          onRetry={editingOrder.reload}
          skeleton={<SkeletonCard lines={6} />}
        >
          {(data) => (
            <>
              <p>
                <StatusBadge status={data.status} /> · {data.vendor_name ?? "—"} · {date(data.order_date)}
                {data.reference ? <> · Ref {data.reference}</> : null}
              </p>

              {actionError ? <div className="alert alert-danger" role="alert">{actionError}</div> : null}

              <div className="card">
                <div className="card-head"><span className="card-title">Order lines</span></div>
                <LineItemsEditor
                  lines={data.lines.map((line, index) => ({ ...line, key: String(line.id ?? index) }))}
                  products={products.data?.items ?? []}
                  analyticAccounts={analyticAccounts.data?.items ?? []}
                  onAdd={() => {}}
                  onRemove={() => {}}
                  onUpdate={() => {}}
                  onSelectProduct={() => {}}
                  totals={{ untaxed_total: data.untaxed_total, tax_total: data.tax_total, total: data.total }}
                  readOnly
                />
              </div>
            </>
          )}
        </AsyncState>
      </Drawer>

      <ConfirmDialog
        open={cancelAction.open}
        onCancel={cancelAction.cancel}
        onConfirm={cancelAction.confirm}
        pending={cancelAction.pending}
        error={cancelAction.error}
        title="Cancel this purchase order?"
        confirmLabel="Cancel order"
        pendingLabel="Cancelling…"
        description={<p>This discards the draft. It hasn&apos;t been billed yet, so nothing in the ledger is affected — but the order itself can&apos;t be recovered once cancelled.</p>}
      />
    </AppShell>
  );
}
