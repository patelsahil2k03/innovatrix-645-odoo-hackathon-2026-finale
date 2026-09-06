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
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusChips } from "@/components/ui/status-chips";
import { TAccountPreview } from "@/components/ui/t-account-preview";
import { DownloadIcon, MailIcon, PlusIcon } from "@/components/icons";
import { PaymentModal } from "@/components/forms/payment-modal";
import {
  api,
  type Account,
  type AnalyticAccount,
  type Contact,
  type Product,
  type VendorBill,
  type VendorBillUpdate,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { buildPurchasePostingPreview, lineDefaultsFromProduct, round2, useDocumentLines } from "@/lib/use-document-lines";
import { useDrawerParam } from "@/lib/use-drawer-param";
import { useStatusFilter } from "@/lib/use-status-counts";
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

interface VendorBillEditFormProps {
  bill: VendorBill;
  vendors: Contact[];
  products: Product[];
  analyticAccounts: AnalyticAccount[];
  onSave: (values: VendorBillUpdate) => Promise<void>;
}

// A DRAFT bill can still be edited — everything past DRAFT is read-only
// (see the parent's status check). Keyed by `bill.id` where it's mounted so
// switching to a different bill while the drawer stays open reseeds instead
// of carrying over stale line state.
function VendorBillEditForm({ bill, vendors, products, analyticAccounts, onSave }: VendorBillEditFormProps) {
  const [vendorId, setVendorId] = useState(bill.vendor_id);
  const [billDate, setBillDate] = useState(bill.bill_date);
  const [dueDate, setDueDate] = useState(bill.due_date ?? "");
  const [reference, setReference] = useState(bill.reference ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { lines, addLine, removeLine, updateLine, selectProduct, totals } = useDocumentLines(bill.lines);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const linesResult = validate(documentLinesSchema, lines);
    if (!linesResult.ok) {
      setFormError("Fix the highlighted lines before saving.");
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        vendor_id: vendorId,
        bill_date: billDate,
        due_date: dueDate || null,
        reference: reference || null,
        lines: linesResult.data,
      });
    } catch (error) {
      setFormError(formMessageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      {formError ? <div className="alert alert-danger" role="alert">{formError}</div> : null}

      <div className="card grid-2">
        <Field label="Vendor" required>
          {(props) => (
            <select {...props} className="select" value={vendorId} onChange={(event) => setVendorId(event.target.value)}>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Bill date" required>
          {(props) => (
            <input {...props} className="input" type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} />
          )}
        </Field>
        <Field label="Due date">
          {(props) => (
            <input {...props} className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          )}
        </Field>
        <Field label="Reference">
          {(props) => (
            <input {...props} className="input" value={reference} onChange={(event) => setReference(event.target.value)} />
          )}
        </Field>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Bill lines</span></div>
        <LineItemsEditor
          lines={lines}
          products={products}
          analyticAccounts={analyticAccounts}
          onAdd={addLine}
          onRemove={removeLine}
          onUpdate={updateLine}
          onSelectProduct={(key, productId) => {
            const product = products.find((p) => p.id === productId);
            selectProduct(key, productId, product ? lineDefaultsFromProduct(product, "purchase") : {});
          }}
          totals={totals}
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={submitting} style={{ alignSelf: "flex-start" }}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

export default function VendorBillsPage() {
  return (
    <Suspense fallback={null}>
      <VendorBillsPageInner />
    </Suspense>
  );
}

function VendorBillsPageInner() {
  const { user } = useAuth();
  const toast = useToast();
  const panel = useDrawerParam();
  const statusFilter = useStatusFilter("vendor_bills");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("-bill_date");
  const debouncedSearch = useDebouncedValue(search, 300);

  const bills = useFetch(
    () => api.vendorBills.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: sort ?? undefined, status: statusFilter.status ?? undefined }),
    [page, debouncedSearch, sort, statusFilter.status],
  );
  useEventStream(
    {
      "document.posted": () => bills.reload(),
      "payment.registered": () => bills.reload(),
    },
    !!user,
  );

  const canRecord = can.record(user?.role.name);
  const canCancel = can.cancelPostedDocument(user?.role.name);

  const contacts = useFetch(() => api.contacts.list({ page_size: 100, sort: "name" }), []);
  const products = useFetch(() => api.products.list({ page_size: 100, sort: "name" }), []);
  const accounts = useFetch(() => api.accounts.list({ page_size: 100 }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 100, sort: "name" }), []);
  const vendors = (contacts.data?.items ?? []).filter((c) => c.type === "VENDOR" || c.type === "BOTH");

  const productsById = useMemo(() => byId<Product>(products.data?.items ?? []), [products.data]);
  const accountsById = useMemo(() => byId<Account>(accounts.data?.items ?? []), [accounts.data]);

  // A narrower filter can leave the current page beyond the last one,
  // which renders an empty table for a list that does have rows. This is
  // React's documented "adjust state during render" pattern rather than an
  // effect: an effect would paint the stale page first, and the lint rule
  // react-hooks/set-state-in-effect rejects it outright.
  const [filteredBy, setFilteredBy] = useState(statusFilter.status);
  if (filteredBy !== statusFilter.status) {
    setFilteredBy(statusFilter.status);
    setPage(1);
  }

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  // Fetched by id rather than read off the currently loaded page, so
  // `?open=<id>` stays a real, reloadable link regardless of search/sort/page
  // — including links in from journal entries / the purchase order it came from.
  const editingId = panel.openId;
  const editingBill = useFetch(
    () => (editingId ? api.vendorBills.get(editingId) : Promise.resolve(null)),
    [editingId],
  );

  // ── Create drawer ────────────────────────────────────────────────────────
  const [reference, setReference] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { lines, addLine, removeLine, updateLine, selectProduct, totals, reset: resetLines } = useDocumentLines();

  const selectedVendor = vendors.find((v) => v.id === vendorId);
  const draftPayableAccount = selectedVendor?.payable_account_id ? accountsById[selectedVendor.payable_account_id] : undefined;
  const draftPayableLabel = draftPayableAccount ? `${draftPayableAccount.code} ${draftPayableAccount.name}` : "2000 Creditors";
  const draftPreview = buildPurchasePostingPreview(lines, draftPayableLabel, productsById, accountsById);

  function resetCreateForm() {
    setReference("");
    setVendorId("");
    setBillDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
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
      await api.vendorBills.create({
        reference: reference || null,
        vendor_id: vendorId,
        bill_date: billDate,
        due_date: dueDate || null,
        lines: linesResult.data,
      });
      toast.success("Vendor bill created");
      resetCreateForm();
      panel.close();
      bills.reload();
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
  const [payOpen, setPayOpen] = useState(false);
  const [confirmPost, setConfirmPost] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function handlePost() {
    if (!editingId) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.vendorBills.post(editingId);
      editingBill.reload();
      bills.reload();
      setConfirmPost(false);
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  const cancelAction = useConfirmAction(async () => {
    if (!editingId) return;
    await api.vendorBills.cancel(editingId);
    editingBill.reload();
    bills.reload();
    toast.success("Bill cancelled");
  });

  async function handleSend() {
    if (!editingId) return;
    setWorking(true);
    setActionError(null);
    try {
      const result = await api.vendorBills.send(editingId);
      setSent(result.to);
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Purchase" }, { label: "Purchase Bill" }]} />
      <div className="page-head">
        <div>
          <h1>Purchase Bills</h1>
          <p>Post a bill to write it into the ledger.</p>
        </div>
        {canRecord ? (
          <Link href={panel.hrefFor("new")} className="btn btn-primary">
            <PlusIcon size={14} />
            New bill
          </Link>
        ) : null}
      </div>

      <SearchInput value={search} onChange={handleSearchChange} label="Search bills" placeholder="Search by number or reference" />

      <StatusChips
        chips={statusFilter.chips}
        active={statusFilter.status}
        hrefFor={statusFilter.hrefFor}
        aria-label="Vendor bills by state"
      />

      <div className="card">
        <AsyncState
          loading={bills.loading}
          error={bills.error}
          data={bills.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No bills yet"
          onRetry={bills.reload}
          skeleton={<SkeletonTable rows={6} columns={7} />}
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
                      <td><Link href={panel.hrefFor(bill.id)}>{bill.number}</Link></td>
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

      <Drawer
        open={panel.isNew}
        onClose={() => { resetCreateForm(); panel.close(); }}
        title="New vendor bill"
       
        footer={
          <button type="submit" form="new-bill-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save bill"}
          </button>
        }
      >
        <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          Saved as a draft — a bill can be raised fresh or from a purchase order.
        </p>
        <form id="new-bill-form" className="stack" onSubmit={handleCreateSubmit} noValidate>
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
            <Field label="Bill date" required>
              {(props) => (
                <input {...props} className="input" type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} />
              )}
            </Field>
            <Field label="Due date">
              {(props) => (
                <input {...props} className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              )}
            </Field>
            <Field label="Reference" hint="The vendor's own bill number, if any">
              {(props) => (
                <input {...props} className="input" value={reference} onChange={(event) => setReference(event.target.value)} />
              )}
            </Field>
          </div>

          <div className="card">
            <div className="card-head"><span className="card-title">Bill lines</span></div>
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

          <div className="card">
            <TAccountPreview {...draftPreview} />
          </div>
        </form>
      </Drawer>

      <Drawer
        open={panel.openId !== null}
        onClose={panel.close}
        title={editingBill.data?.number ?? "Purchase bill"}
       
        footer={
          editingBill.data ? (
            <>
              <a className="btn btn-sm" href={api.vendorBills.pdfUrl(editingBill.data.id)} target="_blank" rel="noreferrer">
                <DownloadIcon size={14} /> PDF
              </a>
              {canRecord ? (
                <button type="button" className="btn btn-sm" onClick={handleSend} disabled={working}>
                  <MailIcon size={14} /> Send
                </button>
              ) : null}
              {canRecord && editingBill.data.status === "DRAFT" ? (
                <button type="button" className="btn btn-primary" onClick={() => setConfirmPost(true)} disabled={working}>
                  Confirm &amp; post
                </button>
              ) : null}
              {canRecord && (editingBill.data.status === "POSTED" || editingBill.data.status === "PARTIAL") ? (
                <button type="button" className="btn btn-primary" onClick={() => setPayOpen(true)} disabled={working}>
                  Pay
                </button>
              ) : null}
              {canCancel && editingBill.data.status !== "CANCELLED" && editingBill.data.status !== "PAID" ? (
                <button type="button" className="btn btn-danger" onClick={cancelAction.request} disabled={working}>
                  Cancel
                </button>
              ) : null}
            </>
          ) : null
        }
      >
        <AsyncState
          loading={editingBill.loading}
          error={editingBill.error}
          data={editingBill.data}
          onRetry={editingBill.reload}
          skeleton={<SkeletonCard lines={6} />}
        >
          {(data) => {
            const vendor = contacts.data?.items.find((c) => c.id === data.vendor_id);
            const payableAccount = vendor?.payable_account_id ? accountsById[vendor.payable_account_id] : undefined;
            const payableLabel = payableAccount ? `${payableAccount.code} ${payableAccount.name}` : "2000 Creditors";
            const preview = buildPurchasePostingPreview(data.lines, payableLabel, productsById, accountsById);
            const remaining = round2(data.total - data.amount_paid);

            return (
              <>
                <p>
                  <StatusBadge status={data.status} /> · {data.vendor_name ?? vendor?.name ?? "—"} ·{" "}
                  Billed {date(data.bill_date)}
                  {data.due_date ? <> · Due {date(data.due_date)}</> : null}
                  {data.reference ? <> · Ref {data.reference}</> : null}
                  {data.po_id ? <> · <Link href={`/purchase/orders?open=${data.po_id}`}>from {data.po_number ?? "purchase order"}</Link></> : null}
                </p>

                {actionError ? <div className="alert alert-danger" role="alert">{actionError}</div> : null}
                {sent ? <div className="alert alert-ok" role="status">Queued for delivery to {sent}.</div> : null}
                {data.status === "PARTIAL" || data.status === "PAID" ? (
                  <div className="alert alert-info">
                    Paid {money(data.amount_paid)} of {money(data.total)}
                    {data.status === "PARTIAL" ? <> — {money(remaining)} remaining.</> : " — settled in full."}
                  </div>
                ) : null}

                {data.status === "DRAFT" && canRecord ? (
                  <VendorBillEditForm
                    key={data.id}
                    bill={data}
                    vendors={vendors}
                    products={products.data?.items ?? []}
                    analyticAccounts={analyticAccounts.data?.items ?? []}
                    onSave={async (values) => {
                      await api.vendorBills.update(data.id, values);
                      toast.success("Bill updated");
                      editingBill.reload();
                      bills.reload();
                    }}
                  />
                ) : (
                  <div className="card">
                    <div className="card-head"><span className="card-title">Bill lines</span></div>
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
                )}

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
                          View the journal entry this bill created →
                        </Link>
                      </p>
                    </div>
                  ) : null}
                </div>

                <Modal
                  open={confirmPost}
                  title="Post this bill?"
                  onClose={() => setConfirmPost(false)}
                  footer={
                    <>
                      <button type="button" className="btn" onClick={() => setConfirmPost(false)}>Cancel</button>
                      <button type="button" className="btn btn-primary" onClick={handlePost} disabled={working}>
                        {working ? "Posting…" : "Confirm & post"}
                      </button>
                    </>
                  }
                >
                  <p>
                    This writes a permanent journal entry for {money(data.total)} into the ledger. A posted
                    bill can never be edited again — only cancelled, which reverses it with a second balanced
                    entry.
                  </p>
                </Modal>

                <PaymentModal
                  open={payOpen}
                  onClose={() => setPayOpen(false)}
                  billId={data.id}
                  direction="SEND"
                  remainingBalance={remaining}
                  onSuccess={() => {
                    editingBill.reload();
                    bills.reload();
                    toast.success("Payment registered");
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
        title="Cancel this bill?"
        confirmLabel="Cancel bill"
        pendingLabel="Cancelling…"
        description={
          editingBill.data ? (
            <p>
              This reverses the {money(editingBill.data.total)} journal entry already posted for
              this bill with a second, balancing entry — the original stays on record
              permanently. This can&apos;t be undone.
            </p>
          ) : null
        }
      />
    </AppShell>
  );
}
