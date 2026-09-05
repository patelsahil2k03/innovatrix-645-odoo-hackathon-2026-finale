"use client";

import Link from "next/link";
import { Suspense, useCallback, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Drawer } from "@/components/ui/drawer";
import { Field } from "@/components/ui/field";
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

export default function ReceiptsPage() {
  return (
    <Suspense fallback={null}>
      <ReceiptsPageInner />
    </Suspense>
  );
}

function ReceiptsPageInner() {
  const { user } = useAuth();
  const toast = useToast();
  const panel = useDrawerParam();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const receipts = useFetch(
    () => api.payments.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, direction: "RECEIVE", sort: "-payment_date" }),
    [page, debouncedSearch],
  );
  useEventStream({ "payment.registered": () => receipts.reload() });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  // ── New receipt drawer — pick an open invoice, then register against it ──
  const [invoiceId, setInvoiceId] = useState("");
  const [payOpen, setPayOpen] = useState(false);

  const invoices = useFetch(
    () => api.customerInvoices.list({ page_size: 100, sort: "-invoice_date" }),
    [],
  );
  const payable = (invoices.data?.items ?? []).filter((inv) => inv.status === "POSTED" || inv.status === "PARTIAL");
  const selected = payable.find((inv) => inv.id === invoiceId);
  const remaining = selected ? round2(selected.total - selected.amount_paid) : 0;

  function closeNewReceipt() {
    setInvoiceId("");
    setPayOpen(false);
    panel.close();
  }

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Sales" }, { label: "Receipt" }]} />
      <div className="page-head">
        <div>
          <h1>Receipts</h1>
          <p>Payments received against sale invoices.</p>
        </div>
        {can.record(user?.role.name) ? (
          <Link href={panel.hrefFor("new")} className="btn btn-primary">
            <PlusIcon size={14} />
            New receipt
          </Link>
        ) : null}
      </div>

      <SearchInput value={search} onChange={handleSearchChange} label="Search receipts" />

      <div className="card">
        <AsyncState
          loading={receipts.loading}
          error={receipts.error}
          data={receipts.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No receipts yet"
          onRetry={receipts.reload}
          skeleton={<SkeletonTable rows={6} columns={6} />}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Number</th><th>Customer</th><th>Journal</th><th>Date</th><th>Note</th><th style={{ textAlign: "right" }}>Amount</th></tr>
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

        {receipts.data ? (
          <Pagination page={receipts.data.page} pages={receipts.data.pages} total={receipts.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>

      <Drawer open={panel.isNew} onClose={closeNewReceipt} title="New receipt" width={35}>
        <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          Register a payment against an open sale invoice.
        </p>
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
              receipts.reload();
              closeNewReceipt();
            }}
          />
        ) : null}
      </Drawer>
    </AppShell>
  );
}
