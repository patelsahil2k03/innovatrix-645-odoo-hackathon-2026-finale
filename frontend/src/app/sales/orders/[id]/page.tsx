"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LineItemsEditor } from "@/components/ui/line-items-editor";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useConfirmAction } from "@/lib/use-confirm-action";
import { formMessageFrom } from "@/lib/validation";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { date } from "@/lib/format";
import { can } from "@/lib/roles";

export default function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const order = useFetch(() => api.salesOrders.get(id), [id]);
  const products = useFetch(() => api.products.list({ page_size: 200 }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 200 }), []);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canRecord = can.record(user?.role.name);

  async function handleConfirm() {
    setWorking(true);
    setActionError(null);
    try {
      await api.salesOrders.confirm(id);
      order.reload();
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleCreateInvoice() {
    setWorking(true);
    setActionError(null);
    try {
      const invoice = await api.salesOrders.createInvoice(id);
      router.push(`/sales/invoices/${invoice.id}`);
    } catch (error) {
      setActionError(formMessageFrom(error));
      setWorking(false);
    }
  }

  const cancelAction = useConfirmAction(async () => {
    await api.salesOrders.cancel(id);
    order.reload();
    toast.success("Sales order cancelled");
  });

  return (
    <AppShell>
      <AsyncState loading={order.loading} error={order.error} data={order.data} onRetry={order.reload}>
        {(data) => (
          <>
            <div className="page-head">
              <div>
                <h1>{data.number}</h1>
                <p>
                  <StatusBadge status={data.status} /> · {data.customer_name ?? "—"} · {date(data.order_date)}
                  {data.reference ? <> · Ref {data.reference}</> : null}
                </p>
              </div>
              {canRecord ? (
                <div className="row">
                  {data.status === "DRAFT" ? (
                    <button type="button" className="btn" onClick={cancelAction.request} disabled={working}>Cancel</button>
                  ) : null}
                  {data.status === "DRAFT" ? (
                    <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={working}>Confirm</button>
                  ) : null}
                  {data.status === "CONFIRMED" ? (
                    <button type="button" className="btn btn-primary" onClick={handleCreateInvoice} disabled={working}>Create invoice</button>
                  ) : null}
                </div>
              ) : null}
            </div>

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

            <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
              <Link href="/sales/orders">← Back to sales orders</Link>
            </p>

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
          </>
        )}
      </AsyncState>
    </AppShell>
  );
}
