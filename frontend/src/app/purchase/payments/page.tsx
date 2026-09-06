"use client";

import Link from "next/link";
import { Suspense, useCallback, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Drawer } from "@/components/ui/drawer";
import { Field } from "@/components/ui/field";
import { PageHeading } from "@/components/ui/page-heading";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonTable } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentModal } from "@/components/forms/payment-modal";
import { PlusIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useDrawerParam } from "@/lib/use-drawer-param";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { round2 } from "@/lib/use-document-lines";
import { date, money } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

export default function PurchasePaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PurchasePaymentsPageInner />
    </Suspense>
  );
}

function PurchasePaymentsPageInner() {
  const { user } = useAuth();
  const toast = useToast();
  const panel = useDrawerParam();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const payments = useFetch(
    () => api.payments.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, direction: "SEND", sort: "-payment_date" }),
    [page, debouncedSearch],
  );
  useEventStream({ "payment.registered": () => payments.reload() });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  // ── New payment drawer — pick an open bill, then register against it ────
  const [billId, setBillId] = useState("");
  const [payOpen, setPayOpen] = useState(false);

  const bills = useFetch(() => api.vendorBills.list({ page_size: 100, sort: "-bill_date" }), []);
  const payable = (bills.data?.items ?? []).filter((bill) => bill.status === "POSTED" || bill.status === "PARTIAL");
  const selected = payable.find((bill) => bill.id === billId);
  const remaining = selected ? round2(selected.total - selected.amount_paid) : 0;

  function closeNewPayment() {
    setBillId("");
    setPayOpen(false);
    panel.close();
  }

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Purchase" }, { label: "Payment" }]} />
      <PageHeading
        image="/img/tabs/payment.webp"
        title="Payments"
        subtitle="Payments sent against vendor bills."
        action={
          can.record(user?.role.name) ? (
            <Link href={panel.hrefFor("new")} className="btn btn-primary">
              <PlusIcon size={14} />
              New payment
            </Link>
          ) : null
        }
      />

      <SearchInput value={search} onChange={handleSearchChange} label="Search payments" />

      <div className="card">
        <AsyncState
          loading={payments.loading}
          error={payments.error}
          data={payments.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No payments yet"
          onRetry={payments.reload}
          skeleton={<SkeletonTable rows={6} columns={6} />}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Number</th><th>Vendor</th><th>Journal</th><th>Date</th><th>Note</th><th style={{ textAlign: "right" }}>Amount</th></tr>
                </thead>
                <tbody>
                  {pageData.items.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.number}</td>
                      <td>{payment.contact_name ?? "—"}</td>
                      <td>{payment.journal_name ?? "—"}</td>
                      <td>{date(payment.payment_date)}</td>
                      <td>{payment.note ?? "—"}</td>
                      <td className="num">{money(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>

        {payments.data ? (
          <Pagination page={payments.data.page} pages={payments.data.pages} total={payments.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>

      <Drawer open={panel.isNew} onClose={closeNewPayment} title="New payment">
        <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          Register a payment against an open vendor bill.
        </p>
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
              payments.reload();
              closeNewPayment();
            }}
          />
        ) : null}
      </Drawer>
    </AppShell>
  );
}
