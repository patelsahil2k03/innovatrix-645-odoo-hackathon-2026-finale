"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Field } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentModal } from "@/components/forms/payment-modal";
import { ClosePanel } from "@/components/ui/close-panel";
import { api } from "@/lib/api";
import { parentRouteOf } from "@/lib/use-close-panel";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { round2 } from "@/lib/use-document-lines";
import { date, money } from "@/lib/format";

export default function NewReceiptPage() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [invoiceId, setInvoiceId] = useState("");
  const [payOpen, setPayOpen] = useState(false);

  // Only invoices that can still take a payment.
  const invoices = useFetch(
    () => api.customerInvoices.list({ page_size: 100, sort: "-invoice_date" }),
    [],
  );
  const payable = (invoices.data?.items ?? []).filter((inv) => inv.status === "POSTED" || inv.status === "PARTIAL");
  const selected = payable.find((inv) => inv.id === invoiceId);
  const remaining = selected ? round2(selected.total - selected.amount_paid) : 0;

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Sales" }, { label: "Receipt", href: "/sales/receipts" }, { label: "New" }]} />
      <div className="page-head">
        <div>
          <h1>New receipt</h1>
          <p>Register a payment against an open sale invoice.</p>
        </div>
        <ClosePanel />
      </div>

      <div className="card stack">
        <Field label="Invoice" required>
          {(props) => (
            <select {...props} className="select" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}>
              <option value="">Select an invoice…</option>
              {payable.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.number} — {inv.customer_name ?? "—"} — due {money(round2(inv.total - inv.amount_paid))}
                </option>
              ))}
            </select>
          )}
        </Field>

        {selected ? (
          <div className="row-between">
            <span>
              <StatusBadge status={selected.status} /> · Total {money(selected.total)} · Paid {money(selected.amount_paid)} ·
              Due {date(selected.due_date)}
            </span>
            <button type="button" className="btn btn-primary" onClick={() => setPayOpen(true)}>
              Register receipt of {money(remaining)}
            </button>
          </div>
        ) : null}
      </div>

      {selected ? (
        <PaymentModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          invoiceId={selected.id}
          direction="RECEIVE"
          remainingBalance={remaining}
          onSuccess={() => {
            toast.success("Receipt registered");
            router.push(parentRouteOf(pathname ?? "/"));
          }}
        />
      ) : null}
    </AppShell>
  );
}
