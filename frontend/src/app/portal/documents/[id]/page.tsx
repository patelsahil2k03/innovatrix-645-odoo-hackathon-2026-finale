"use client";

import Link from "next/link";
import { use, useState } from "react";

import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SkeletonCard } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { DownloadIcon } from "@/components/icons";
import { PaymentModal } from "@/components/forms/payment-modal";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type CustomerInvoice, type VendorBill } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { round2 } from "@/lib/use-document-lines";
import { date, money } from "@/lib/format";

function isInvoice(doc: CustomerInvoice | VendorBill): doc is CustomerInvoice {
  return "customer_id" in doc;
}

export default function PortalDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const doc = useFetch(() => api.portal.documents.get(id), [id]);
  const [payOpen, setPayOpen] = useState(false);

  return (
    <>
      <Breadcrumbs items={[{ label: "My Documents", href: "/portal/documents" }, { label: doc.data?.number ?? "…" }]} />
      <p style={{ fontSize: "var(--t-sm)" }}><Link href="/portal/documents">← My Documents</Link></p>

      <AsyncState
        loading={doc.loading}
        error={doc.error}
        data={doc.data}
        onRetry={doc.reload}
        skeleton={<SkeletonCard lines={4} />}
      >
        {(data) => {
          const invoice = isInvoice(data);
          const remaining = round2(data.total - data.amount_paid);
          const canPay = data.status === "POSTED" || data.status === "PARTIAL";
          const pdfUrl = invoice ? api.customerInvoices.pdfUrl(data.id) : api.vendorBills.pdfUrl(data.id);

          return (
            <>
              <div className="page-head">
                <div>
                  <h1>{data.number}</h1>
                  <p>
                    <StatusBadge status={data.status} /> · {date(invoice ? data.invoice_date : data.bill_date)}
                    {data.reference ? <> · Ref {data.reference}</> : null}
                  </p>
                </div>
                <div className="row">
                  <a className="btn btn-sm" href={pdfUrl} target="_blank" rel="noreferrer">
                    <DownloadIcon size={14} /> PDF
                  </a>
                  {canPay ? (
                    <button type="button" className="btn btn-primary" onClick={() => setPayOpen(true)}>
                      Pay {money(remaining)}
                    </button>
                  ) : null}
                </div>
                <ClosePanel />
              </div>

              <div className="kpi-grid">
                <div className="kpi"><span className="kpi-label">Total</span><span className="kpi-value">{money(data.total)}</span></div>
                <div className="kpi"><span className="kpi-label">Paid</span><span className="kpi-value">{money(data.amount_paid)}</span></div>
                <div className="kpi"><span className="kpi-label">Balance due</span><span className="kpi-value">{money(remaining)}</span></div>
              </div>

              <div className="card">
                <div className="card-head"><span className="card-title">Lines</span></div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead><tr><th>Qty</th><th style={{ textAlign: "right" }}>Unit price</th><th style={{ textAlign: "right" }}>Tax %</th></tr></thead>
                    <tbody>
                      {data.lines.map((line, index) => (
                        <tr key={line.id ?? index}>
                          <td>{line.quantity}</td>
                          <td className="num">{money(line.unit_price)}</td>
                          <td className="num">{line.tax_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <PaymentModal
                open={payOpen}
                onClose={() => setPayOpen(false)}
                invoiceId={invoice ? data.id : undefined}
                billId={invoice ? undefined : data.id}
                direction={invoice ? "RECEIVE" : "SEND"}
                remainingBalance={remaining}
                onSuccess={() => {
                  doc.reload();
                  toast.success("Payment registered");
                }}
                usePortal
              />
            </>
          );
        }}
      </AsyncState>
    </>
  );
}
