"use client";

import Link from "next/link";
import { use } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { SkeletonTable } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type CustomerInvoice, type VendorBill } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { date, money } from "@/lib/format";

function isInvoice(doc: CustomerInvoice | VendorBill): doc is CustomerInvoice {
  return "customer_id" in doc;
}

/**
 * "Clicking the achieved figure opens a filtered list of vendor bills — every
 * one carrying the tag inside the period — which is exactly the query that
 * produced the number" (13_DESIGN_FAQ.md, Walkthrough C). A real URL, so it
 * can be reloaded and shared like every other drill-down in this app.
 */
export default function BudgetLineDocumentsPage({ params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { id, lineId } = use(params);
  const budget = useFetch(() => api.budgets.get(id), [id]);
  const documents = useFetch(() => api.budgets.lineDocuments(id, lineId), [id, lineId]);
  const line = budget.data?.lines.find((l) => l.id === lineId);

  return (
    <AppShell>
      <Breadcrumbs
        items={[
          { label: "Account" },
          { label: "Analytical Budget", href: "/account/budgets" },
          { label: budget.data?.name ?? "Budget", href: `/account/budgets?open=${id}` },
          { label: line?.analytic_account_name ?? "Documents" },
        ]}
      />

      <div className="page-head">
        <div>
          <h1>Documents behind {line?.analytic_account_name ?? "this line"}</h1>
          <p>Every invoice or bill line tagged with this analytic account, inside the budget&apos;s period.</p>
        </div>
        {/* One segment up is `/lines/{lineId}`, which is not a page — this
            drill-down closes back to the budget it came from. */}
        <ClosePanel fallbackHref={`/account/budgets?open=${id}`} label="Close and return to budget" />
      </div>

      <div className="card">
        <AsyncState
          loading={documents.loading}
          error={documents.error}
          data={documents.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="Nothing posted against this line yet"
          onRetry={documents.reload}
          skeleton={<SkeletonTable rows={5} columns={5} />}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Number</th><th>Partner</th><th>Date</th><th>Status</th><th style={{ textAlign: "right" }}>Total</th></tr>
                </thead>
                <tbody>
                  {pageData.items.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        {isInvoice(doc) ? (
                          <Link href={`/sales/invoices?open=${doc.id}`}>{doc.number}</Link>
                        ) : (
                          <Link href={`/purchase/bills?open=${doc.id}`}>{doc.number}</Link>
                        )}
                      </td>
                      <td>{isInvoice(doc) ? doc.customer_name : doc.vendor_name}</td>
                      <td>{date(isInvoice(doc) ? doc.invoice_date : doc.bill_date)}</td>
                      <td><StatusBadge status={doc.status} /></td>
                      <td className="num">{money(doc.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>
      </div>
    </AppShell>
  );
}
