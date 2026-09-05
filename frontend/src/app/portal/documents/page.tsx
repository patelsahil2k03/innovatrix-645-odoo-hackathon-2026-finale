"use client";

import Link from "next/link";
import { useState } from "react";

import { AsyncState } from "@/components/ui/async-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, type CustomerInvoice, type VendorBill } from "@/lib/api";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { date, money } from "@/lib/format";

const PAGE_SIZE = 20;

function isInvoice(doc: CustomerInvoice | VendorBill): doc is CustomerInvoice {
  return "customer_id" in doc;
}

export default function MyDocumentsPage() {
  const [page, setPage] = useState(1);
  const documents = useFetch(
    () => api.portal.documents.list({ page, page_size: PAGE_SIZE, sort: "-invoice_date" }),
    [page],
  );
  useEventStream({
    "document.posted": () => documents.reload(),
    "payment.registered": () => documents.reload(),
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My Documents</h1>
          <p>Your invoices and bills — pay any open one directly from here.</p>
        </div>
      </div>

      <div className="card">
        <AsyncState
          loading={documents.loading}
          error={documents.error}
          data={documents.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="Nothing here yet"
          onRetry={documents.reload}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Number</th><th>Date</th><th>Status</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Balance due</th></tr>
                </thead>
                <tbody>
                  {pageData.items.map((doc) => (
                    <tr key={doc.id}>
                      <td><Link href={`/portal/documents/${doc.id}`}>{doc.number}</Link></td>
                      <td>{date(isInvoice(doc) ? doc.invoice_date : doc.bill_date)}</td>
                      <td><StatusBadge status={doc.status} /></td>
                      <td className="num">{money(doc.total)}</td>
                      <td className="num">{money(doc.total - doc.amount_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>

        {documents.data ? (
          <Pagination page={documents.data.page} pages={documents.data.pages} total={documents.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>
    </>
  );
}
