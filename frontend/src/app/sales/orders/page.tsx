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

export default function SalesOrdersPage() {
  return (
    <Suspense fallback={null}>
      <SalesOrdersPageInner />
    </Suspense>
  );
}

function SalesOrdersPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const panel = useDrawerParam();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("-order_date");
  const debouncedSearch = useDebouncedValue(search, 300);

  const orders = useFetch(
    () => api.salesOrders.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: sort ?? undefined }),
    [page, debouncedSearch, sort],
  );
  useEventStream({ "document.posted": () => orders.reload() }, !!user);

  const canRecord = can.record(user?.role.name);

  const contacts = useFetch(() => api.contacts.list({ page_size: 100, sort: "name" }), []);
  const products = useFetch(() => api.products.list({ page_size: 100, sort: "name" }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 100, sort: "name" }), []);
  const customers = (contacts.data?.items ?? []).filter((c) => c.type === "CUSTOMER" || c.type === "BOTH");

  // Fetched by id rather than read off the currently loaded page, so
  // `?open=<id>` stays a real, reloadable link regardless of search/sort/page.
  const editingId = panel.openId;
  const editingOrder = useFetch(
    () => (editingId ? api.salesOrders.get(editingId) : Promise.resolve(null)),
    [editingId],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  // ── Create drawer ────────────────────────────────────────────────────────
  const [reference, setReference] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { lines, addLine, removeLine, updateLine, selectProduct, totals, reset: resetLines } = useDocumentLines();

  function resetCreateForm() {
    setReference("");
    setCustomerId("");
    setOrderDate(new Date().toISOString().slice(0, 10));
    setFormError(null);
    setCustomerError(null);
    resetLines();
  }

  async function handleCreateSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const customerResult = validate(required("Customer"), customerId);
    const linesResult = validate(documentLinesSchema, lines);
    if (!customerResult.ok) {
      setCustomerError(customerResult.errors.form ?? "Customer is required");
      return;
    }
    setCustomerError(null);
    if (!linesResult.ok) {
      setFormError("Fix the highlighted lines before saving.");
      return;
    }

    setSubmitting(true);
    try {
      await api.salesOrders.create({
        reference: reference || null,
        customer_id: customerId,
        order_date: orderDate,
        lines: linesResult.data,
      });
      toast.success("Sales order created");
      resetCreateForm();
      panel.close();
      orders.reload();
    } catch (error) {
      setFormError(formMessageFrom(error));
      const fields = fieldErrorsFrom(error);
      if (fields.customer_id) setCustomerError(fields.customer_id);
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
      await api.salesOrders.confirm(editingId);
      editingOrder.reload();
      orders.reload();
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleCreateInvoice() {
    if (!editingId) return;
    setWorking(true);
    setActionError(null);
    try {
      const invoice = await api.salesOrders.createInvoice(editingId);
      panel.close();
      router.push(`/sales/invoices?open=${invoice.id}`);
    } catch (error) {
      setActionError(formMessageFrom(error));
      setWorking(false);
    }
  }

  const cancelAction = useConfirmAction(async () => {
    if (!editingId) return;
    await api.salesOrders.cancel(editingId);
    editingOrder.reload();
    orders.reload();
    toast.success("Sales order cancelled");
  });

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Sales" }, { label: "Sales Order" }]} />
      <div className="page-head">
        <div>
          <h1>Sales Orders</h1>
          <p>Confirm an order, then create the invoice from it.</p>
        </div>
        {canRecord ? (
          <Link href={panel.hrefFor("new")} className="btn btn-primary">
            <PlusIcon size={14} />
            New sales order
          </Link>
        ) : null}
      </div>

      <SearchInput value={search} onChange={handleSearchChange} label="Search sales orders" placeholder="Search by number or reference" />

      <div className="card">
        <AsyncState
          loading={orders.loading}
          error={orders.error}
          data={orders.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No sales orders yet"
          onRetry={orders.reload}
          skeleton={<SkeletonTable rows={6} columns={5} />}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Customer</th>
                    <SortableTh label="Order date" sortKey="order_date" current={sort} onSort={setSort} />
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((order) => (
                    <tr key={order.id}>
                      <td><Link href={panel.hrefFor(order.id)}>{order.number}</Link></td>
                      <td>{order.customer_name ?? "—"}</td>
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
        title="New sales order"
       
        footer={
          <button type="submit" form="new-sales-order-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save sales order"}
          </button>
        }
      >
        <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          Nothing posts to the ledger until this becomes an invoice and that invoice is posted.
        </p>
        <form id="new-sales-order-form" className="stack" onSubmit={handleCreateSubmit} noValidate>
          {formError ? <div className="alert alert-danger" role="alert">{formError}</div> : null}

          <div className="card grid-2">
            <Field label="Customer" error={customerError ?? undefined} required>
              {(props) => (
                <select {...props} className="select" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  <option value="">Select a customer…</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Order date" required>
              {(props) => (
                <input {...props} className="input" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
              )}
            </Field>
            <Field label="Reference" hint="The customer's own PO number, if any">
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
                selectProduct(key, productId, product ? lineDefaultsFromProduct(product, "sales") : {});
              }}
              totals={totals}
            />
          </div>
        </form>
      </Drawer>

      <Drawer
        open={panel.openId !== null}
        onClose={panel.close}
        title={editingOrder.data?.number ?? "Sales order"}
       
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
                <button type="button" className="btn btn-primary" onClick={handleCreateInvoice} disabled={working}>Create invoice</button>
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
                <StatusBadge status={data.status} /> · {data.customer_name ?? "—"} · {date(data.order_date)}
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
        title="Cancel this sales order?"
        confirmLabel="Cancel order"
        pendingLabel="Cancelling…"
        description={<p>This discards the draft. It hasn&apos;t been invoiced yet, so nothing in the ledger is affected — but the order itself can&apos;t be recovered once cancelled.</p>}
      />
    </AppShell>
  );
}
