"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
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

export default function NewPurchasePaymentPage() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [billId, setBillId] = useState("");
  const [payOpen, setPayOpen] = useState(false);

  const bills = useFetch(() => api.vendorBills.list({ page_size: 100, sort: "-bill_date" }), []);
  const payable = (bills.data?.items ?? []).filter((bill) => bill.status === "POSTED" || bill.status === "PARTIAL");
  const selected = payable.find((bill) => bill.id === billId);
  const remaining = selected ? round2(selected.total - selected.amount_paid) : 0;

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>New payment</h1>
          <p>Register a payment against an open vendor bill.</p>
        </div>
        <ClosePanel />
      </div>

      <div className="card stack">
        <Field label="Bill" required>
          {(props) => (
            <select {...props} className="select" value={billId} onChange={(event) => setBillId(event.target.value)}>
              <option value="">Select a bill…</option>
              {payable.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.number} — {bill.vendor_name ?? "—"} — due {money(round2(bill.total - bill.amount_paid))}
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
              Register payment of {money(remaining)}
            </button>
          </div>
        ) : null}
      </div>

      {selected ? (
        <PaymentModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          billId={selected.id}
          direction="SEND"
          remainingBalance={remaining}
          onSuccess={() => {
            toast.success("Payment registered");
            router.push(parentRouteOf(pathname ?? "/"));
          }}
        />
      ) : null}
    </AppShell>
  );
}
