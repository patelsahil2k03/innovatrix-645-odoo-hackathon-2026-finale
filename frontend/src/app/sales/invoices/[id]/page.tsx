"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { LineItemsEditor } from "@/components/ui/line-items-editor";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { TAccountPreview } from "@/components/ui/t-account-preview";
import { DownloadIcon, MailIcon } from "@/components/icons";
import { PaymentModal } from "@/components/forms/payment-modal";
import { api, type Account, type Product } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { buildSalesPostingPreview, round2 } from "@/lib/use-document-lines";
import { formMessageFrom } from "@/lib/validation";
import { date, money } from "@/lib/format";
import { can } from "@/lib/roles";

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export default function CustomerInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const invoice = useFetch(() => api.customerInvoices.get(id), [id]);
  const products = useFetch(() => api.products.list({ page_size: 200 }), []);
  const accounts = useFetch(() => api.accounts.list({ page_size: 200 }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 200 }), []);
  const contacts = useFetch(() => api.contacts.list({ page_size: 200 }), []);

  useEventStream({
    "document.posted": (payload) => { if (payload.id === id) invoice.reload(); },
    "payment.registered": () => invoice.reload(),
  });

  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [confirmPost, setConfirmPost] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const productsById = useMemo(() => byId<Product>(products.data?.items ?? []), [products.data]);
  const accountsById = useMemo(() => byId<Account>(accounts.data?.items ?? []), [accounts.data]);

  const canRecord = can.record(user?.role.name);
  const canCancel = can.cancelPostedDocument(user?.role.name);

  async function handlePost() {
    setWorking(true);
    setActionError(null);
    try {
      await api.customerInvoices.post(id);
      invoice.reload();
      setConfirmPost(false);
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleCancel() {
    setWorking(true);
    setActionError(null);
    try {
      await api.customerInvoices.cancel(id);
      invoice.reload();
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleSend() {
    setWorking(true);
    setActionError(null);
    try {
      const result = await api.customerInvoices.send(id);
      setSent(result.to);
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  return (
    <AppShell>
      <AsyncState loading={invoice.loading} error={invoice.error} data={invoice.data} onRetry={invoice.reload}>
        {(data) => {
          const customer = contacts.data?.items.find((c) => c.id === data.customer_id);
          const receivableAccount = customer?.receivable_account_id ? accountsById[customer.receivable_account_id] : undefined;
          const receivableLabel = receivableAccount ? `${receivableAccount.code} ${receivableAccount.name}` : "1100 Debtors";
          const preview = buildSalesPostingPreview(data.lines, receivableLabel, productsById, accountsById);
          const remaining = round2(data.total - data.amount_paid);

          return (
            <>
              <div className="page-head">
                <div>
                  <h1>{data.number}</h1>
                  <p>
                    <StatusBadge status={data.status} /> · {data.customer_name ?? customer?.name ?? "—"} ·{" "}
                    Invoiced {date(data.invoice_date)}
                    {data.due_date ? <> · Due {date(data.due_date)}</> : null}
                    {data.reference ? <> · Ref {data.reference}</> : null}
                    {data.so_id ? <> · <Link href={`/sales/orders/${data.so_id}`}>from {data.so_number ?? "sales order"}</Link></> : null}
                  </p>
                </div>
                <div className="row">
                  <a className="btn btn-sm" href={api.customerInvoices.pdfUrl(id)} target="_blank" rel="noreferrer">
                    <DownloadIcon size={14} /> PDF
                  </a>
                  {canRecord ? (
                    <button type="button" className="btn btn-sm" onClick={handleSend} disabled={working}>
                      <MailIcon size={14} /> Send
                    </button>
                  ) : null}
                  {canRecord && data.status === "DRAFT" ? (
                    <button type="button" className="btn btn-primary" onClick={() => setConfirmPost(true)} disabled={working}>
                      Confirm &amp; post
                    </button>
                  ) : null}
                  {canRecord && (data.status === "POSTED" || data.status === "PARTIAL") ? (
                    <button type="button" className="btn btn-primary" onClick={() => setPayOpen(true)} disabled={working}>
                      Pay
                    </button>
                  ) : null}
                  {canCancel && data.status !== "CANCELLED" && data.status !== "PAID" ? (
                    <button type="button" className="btn btn-danger" onClick={handleCancel} disabled={working}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>

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
                  onAdd={() => {}}
                  onRemove={() => {}}
                  onUpdate={() => {}}
                  onSelectProduct={() => {}}
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
                      <Link href={`/account/journal-entries/${data.journal_entry_id}`}>
                        View the journal entry this invoice created →
                      </Link>
                    </p>
                  </div>
                ) : null}
              </div>

              <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
                <Link href="/sales/invoices">← Back to sale invoices</Link>
              </p>

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
                invoiceId={id}
                direction="RECEIVE"
                remainingBalance={remaining}
                onSuccess={() => invoice.reload()}
              />
            </>
          );
        }}
      </AsyncState>
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
