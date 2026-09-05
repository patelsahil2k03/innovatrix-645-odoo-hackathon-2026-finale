"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { Field } from "@/components/ui/field";
import { LineItemsEditor } from "@/components/ui/line-items-editor";
import { Modal } from "@/components/ui/modal";
import { PageHeading } from "@/components/ui/page-heading";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { TAccountPreview } from "@/components/ui/t-account-preview";
import { DownloadIcon, MailIcon, PlusIcon } from "@/components/icons";
import { PaymentModal } from "@/components/forms/payment-modal";
import { api, type Account, type Product } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { buildSalesPostingPreview, lineDefaultsFromProduct, round2, useDocumentLines } from "@/lib/use-document-lines";
import { useDrawerParam } from "@/lib/use-drawer-param";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { documentLinesSchema, fieldErrorsFrom, formMessageFrom, required, validate } from "@/lib/validation";
import { date, money } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export default function CustomerInvoicesPage() {
  return (
    <Suspense fallback={null}>
      <CustomerInvoicesPageInner />
    </Suspense>
  );
}

function CustomerInvoicesPageInner() {
  const { user } = useAuth();
  const toast = useToast();
  const panel = useDrawerParam();
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

  const canRecord = can.record(user?.role.name);
  const canCancel = can.cancelPostedDocument(user?.role.name);

  const contacts = useFetch(() => api.contacts.list({ page_size: 100, sort: "name" }), []);
  const products = useFetch(() => api.products.list({ page_size: 100, sort: "name" }), []);
  const accounts = useFetch(() => api.accounts.list({ page_size: 100 }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 100, sort: "name" }), []);
  const customers = (contacts.data?.items ?? []).filter((c) => c.type === "CUSTOMER" || c.type === "BOTH");

  const productsById = useMemo(() => byId<Product>(products.data?.items ?? []), [products.data]);
  const accountsById = useMemo(() => byId<Account>(accounts.data?.items ?? []), [accounts.data]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  // Fetched by id rather than read off the currently loaded page, so
  // `?open=<id>` stays a real, reloadable link regardless of search/sort/page
  // — including links in from journal entries / the sales order it came from.
  const editingId = panel.openId;
  const editingInvoice = useFetch(
    () => (editingId ? api.customerInvoices.get(editingId) : Promise.resolve(null)),
    [editingId],
  );

  // ── Create drawer ────────────────────────────────────────────────────────
  const [reference, setReference] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { lines, addLine, removeLine, updateLine, selectProduct, totals, reset: resetLines } = useDocumentLines();

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const draftReceivableAccount = selectedCustomer?.receivable_account_id
    ? accountsById[selectedCustomer.receivable_account_id]
    : undefined;
  const draftReceivableLabel = draftReceivableAccount
    ? `${draftReceivableAccount.code} ${draftReceivableAccount.name}`
    : "1100 Debtors";
  const draftPreview = buildSalesPostingPreview(lines, draftReceivableLabel, productsById, accountsById);

  function resetCreateForm() {
    setReference("");
    setCustomerId("");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
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
      setCustomerError("Customer is required");
      return;
    }
    setCustomerError(null);
    if (!linesResult.ok) {
      setFormError("Fix the highlighted lines before saving.");
      return;
    }

    setSubmitting(true);
    try {
      await api.customerInvoices.create({
        reference: reference || null,
        customer_id: customerId,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        lines: linesResult.data,
      });
      toast.success("Customer invoice created");
      resetCreateForm();
      panel.close();
      invoices.reload();
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
  const [payOpen, setPayOpen] = useState(false);
  const [confirmPost, setConfirmPost] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function handlePost() {
    if (!editingId) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.customerInvoices.post(editingId);
      editingInvoice.reload();
      invoices.reload();
      setConfirmPost(false);
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  const cancelAction = useConfirmAction(async () => {
    if (!editingId) return;
    await api.customerInvoices.cancel(editingId);
    editingInvoice.reload();
    invoices.reload();
    toast.success("Invoice cancelled");
  });

  async function handleSend() {
    if (!editingId) return;
    setWorking(true);
    setActionError(null);
    try {
      const result = await api.customerInvoices.send(editingId);
      setSent(result.to);
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }

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
                      <td><Link href={panel.hrefFor(invoice.id)}>{invoice.number}</Link></td>
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

      <Drawer
        open={panel.isNew}
        onClose={() => { resetCreateForm(); panel.close(); }}
        title="New sale invoice"

        footer={
          <button type="submit" form="new-invoice-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save invoice"}
          </button>
        }
      >
        <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          Saved as a draft — nothing posts to the ledger until you confirm it.
        </p>
        <form id="new-invoice-form" className="stack" onSubmit={handleCreateSubmit} noValidate>
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
            <Field label="Invoice date" required>
              {(props) => (
                <input {...props} className="input" type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
              )}
            </Field>
            <Field label="Due date">
              {(props) => (
                <input {...props} className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              )}
            </Field>
            <Field label="Reference" hint="The customer's own PO number, if any">
              {(props) => (
                <input {...props} className="input" value={reference} onChange={(event) => setReference(event.target.value)} />
              )}
            </Field>
          </div>

          <div className="card">
            <div className="card-head"><span className="card-title">Invoice lines</span></div>
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

          <div className="card">
            <TAccountPreview {...draftPreview} />
          </div>
        </form>
      </Drawer>

      <Drawer
        open={panel.openId !== null}
        onClose={panel.close}
        title={editingInvoice.data?.number ?? "Sale invoice"}

        footer={
          editingInvoice.data ? (
            <>
              <a className="btn btn-sm" href={api.customerInvoices.pdfUrl(editingInvoice.data.id)} target="_blank" rel="noreferrer">
                <DownloadIcon size={14} /> PDF
              </a>
              {canRecord ? (
                <button type="button" className="btn btn-sm" onClick={handleSend} disabled={working}>
                  <MailIcon size={14} /> Send
                </button>
              ) : null}
              {canRecord && editingInvoice.data.status === "DRAFT" ? (
                <button type="button" className="btn btn-primary" onClick={() => setConfirmPost(true)} disabled={working}>
                  Confirm &amp; post
                </button>
              ) : null}
              {canRecord && (editingInvoice.data.status === "POSTED" || editingInvoice.data.status === "PARTIAL") ? (
                <button type="button" className="btn btn-primary" onClick={() => setPayOpen(true)} disabled={working}>
                  Pay
                </button>
              ) : null}
              {canCancel && editingInvoice.data.status !== "CANCELLED" && editingInvoice.data.status !== "PAID" ? (
                <button type="button" className="btn btn-danger" onClick={cancelAction.request} disabled={working}>
                  Cancel
                </button>
              ) : null}
            </>
          ) : null
        }
      >
        <AsyncState
          loading={editingInvoice.loading}
          error={editingInvoice.error}
          data={editingInvoice.data}
          onRetry={editingInvoice.reload}
          skeleton={<SkeletonCard lines={6} />}
        >
          {(data) => {
            const customer = contacts.data?.items.find((c) => c.id === data.customer_id);
            const receivableAccount = customer?.receivable_account_id ? accountsById[customer.receivable_account_id] : undefined;
            const receivableLabel = receivableAccount ? `${receivableAccount.code} ${receivableAccount.name}` : "1100 Debtors";
            const preview = buildSalesPostingPreview(data.lines, receivableLabel, productsById, accountsById);
            const remaining = round2(data.total - data.amount_paid);

            return (
              <>
                <p>
                  <StatusBadge status={data.status} /> · {data.customer_name ?? customer?.name ?? "—"} ·{" "}
                  Invoiced {date(data.invoice_date)}
                  {data.due_date ? <> · Due {date(data.due_date)}</> : null}
                  {data.reference ? <> · Ref {data.reference}</> : null}
                  {data.so_id ? <> · <Link href={`/sales/orders?open=${data.so_id}`}>from {data.so_number ?? "sales order"}</Link></> : null}
                </p>

                {actionError ? <div className="alert alert-danger" role="alert">{actionError}</div> : null}
                {sent ? <div className="alert alert-ok" role="status">Queued for delivery to {sent}.</div> : null}
                {data.status === "PARTIAL" || data.status === "PAID" ? (
                  <div className="alert alert-info">
                    Paid {money(data.amount_paid)} of {money(data.total)}
                    {data.status === "PARTIAL" ? <> — {money(remaining)} remaining.</> : " — settled in full."}
                  </div>
                ) : null}

                <div className="card">
                  <div className="card-head"><span className="card-title">Invoice lines</span></div>
                  <LineItemsEditor
                    lines={data.lines.map((line, index) => ({ ...line, key: String(line.id ?? index) }))}
                    products={products.data?.items ?? []}
                    analyticAccounts={analyticAccounts.data?.items ?? []}
                    onAdd={() => { }}
                    onRemove={() => { }}
                    onUpdate={() => { }}
                    onSelectProduct={() => { }}
                    totals={{ untaxed_total: data.untaxed_total, tax_total: data.tax_total, total: data.total }}
                    readOnly
                  />
                </div>

                <div className="card">
                  {data.status === "DRAFT" ? (
                    <TAccountPreview {...preview} />
                  ) : data.journal_entry_id ? (
                    <div className="stack">
                      <div className="card-head" style={{ marginBottom: 0 }}>
                        <span className="card-title">Posted journal entry</span>
                      </div>
                      <p style={{ fontSize: "var(--t-sm)" }}>
                        <Link href={`/account/journal-entries?open=${data.journal_entry_id}`}>
                          View the journal entry this invoice created →
                        </Link>
                      </p>
                    </div>
                  ) : null}
                </div>

                <ConfirmPostModal
                  open={confirmPost}
                  onClose={() => setConfirmPost(false)}
                  onConfirm={handlePost}
                  working={working}
                  total={data.total}
                />

                <PaymentModal
                  open={payOpen}
                  onClose={() => setPayOpen(false)}
                  invoiceId={data.id}
                  direction="RECEIVE"
                  remainingBalance={remaining}
                  onSuccess={() => {
                    editingInvoice.reload();
                    invoices.reload();
                    toast.success("Receipt registered");
                  }}
                />
              </>
            );
          }}
        </AsyncState>
      </Drawer>

      <ConfirmDialog
        open={cancelAction.open}
        onCancel={cancelAction.cancel}
        onConfirm={cancelAction.confirm}
        pending={cancelAction.pending}
        error={cancelAction.error}
        tone="danger"
        title="Cancel this invoice?"
        confirmLabel="Cancel invoice"
        pendingLabel="Cancelling…"
        description={
          editingInvoice.data ? (
            <p>
              This reverses the {money(editingInvoice.data.total)} journal entry already posted for
              this invoice with a second, balancing entry — the original stays on
              record permanently. This can&apos;t be undone.
            </p>
          ) : null
        }
      />
    </AppShell>
  );
}

/* Kept local — a one-off confirm dialog for the single most irreversible
 * action on this screen (05_FRONTEND.md §7: "Posting is irreversible"). */
function ConfirmPostModal({
  open, onClose, onConfirm, working, total,
}: { open: boolean; onClose: () => void; onConfirm: () => void; working: boolean; total: number }) {
  return (
    <Modal
      open={open}
      title="Post this invoice?"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={working}>
            {working ? "Posting…" : "Confirm & post"}
          </button>
        </>
      }
    >
      <p>
        This writes a permanent journal entry for {money(total)} into the ledger. A posted
        invoice can never be edited again — only cancelled, which reverses it with a second
        balanced entry.
      </p>
    </Modal>
  );
}
