"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LineItemsEditor } from "@/components/ui/line-items-editor";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { TAccountPreview } from "@/components/ui/t-account-preview";
import { DownloadIcon, MailIcon } from "@/components/icons";
import { PaymentModal } from "@/components/forms/payment-modal";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type Account, type Product } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { buildPurchasePostingPreview, round2 } from "@/lib/use-document-lines";
import { formMessageFrom } from "@/lib/validation";
import { date, money } from "@/lib/format";
import { can } from "@/lib/roles";

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export default function VendorBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const toast = useToast();
  const bill = useFetch(() => api.vendorBills.get(id), [id]);
  const products = useFetch(() => api.products.list({ page_size: 100 }), []);
  const accounts = useFetch(() => api.accounts.list({ page_size: 100 }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 100 }), []);
  const contacts = useFetch(() => api.contacts.list({ page_size: 100 }), []);

  useEventStream({
    "document.posted": (payload) => { if (payload.id === id) bill.reload(); },
    "payment.registered": () => bill.reload(),
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
      await api.vendorBills.post(id);
      bill.reload();
      setConfirmPost(false);
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  const cancelAction = useConfirmAction(async () => {
    await api.vendorBills.cancel(id);
    bill.reload();
    toast.success("Bill cancelled");
  });

  async function handleSend() {
    setWorking(true);
    setActionError(null);
    try {
      const result = await api.vendorBills.send(id);
      setSent(result.to);
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  return (
    <AppShell>
      <AsyncState loading={bill.loading} error={bill.error} data={bill.data} onRetry={bill.reload}>
        {(data) => {
          const vendor = contacts.data?.items.find((c) => c.id === data.vendor_id);
          const payableAccount = vendor?.payable_account_id ? accountsById[vendor.payable_account_id] : undefined;
          const payableLabel = payableAccount ? `${payableAccount.code} ${payableAccount.name}` : "2000 Creditors";
          const preview = buildPurchasePostingPreview(data.lines, payableLabel, productsById, accountsById);
          const remaining = round2(data.total - data.amount_paid);

          return (
            <>
              <div className="page-head">
                <div>
                  <h1>{data.number}</h1>
                  <p>
                    <StatusBadge status={data.status} /> · {data.vendor_name ?? vendor?.name ?? "—"} ·{" "}
                    Billed {date(data.bill_date)}
                    {data.due_date ? <> · Due {date(data.due_date)}</> : null}
                    {data.reference ? <> · Ref {data.reference}</> : null}
                    {data.po_id ? <> · <Link href={`/purchase/orders/${data.po_id}`}>from {data.po_number ?? "purchase order"}</Link></> : null}
                  </p>
                </div>
                <div className="row">
                  <a className="btn btn-sm" href={api.vendorBills.pdfUrl(id)} target="_blank" rel="noreferrer">
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
                    <button type="button" className="btn btn-danger" onClick={cancelAction.request} disabled={working}>
                      Cancel
                    </button>
                  ) : null}
                </div>
                <ClosePanel />
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
                        View the journal entry this bill created →
                      </Link>
                    </p>
                  </div>
                ) : null}
              </div>

              <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
                <Link href="/purchase/bills">← Back to purchase bills</Link>
              </p>

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
                billId={id}
                direction="SEND"
                remainingBalance={remaining}
                onSuccess={() => {
                  bill.reload();
                  toast.success("Payment registered");
                }}
              />

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
                  <p>
                    This reverses the {money(data.total)} journal entry already posted for
                    this bill with a second, balancing entry — the original stays on record
                    permanently. This can&apos;t be undone.
                  </p>
                }
              />
            </>
          );
        }}
      </AsyncState>
    </AppShell>
  );
}
