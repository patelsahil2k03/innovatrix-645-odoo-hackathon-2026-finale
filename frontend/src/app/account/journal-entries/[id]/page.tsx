"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, use } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ClosePanel } from "@/components/ui/close-panel";
import { api } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { date, humanize, money } from "@/lib/format";

const SOURCE_HREF: Partial<Record<string, (sourceId: string) => string>> = {
  customer_invoice: (id) => `/sales/invoices/${id}`,
  vendor_bill: (id) => `/purchase/bills/${id}`,
};

export default function JournalEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <JournalEntryDetailInner params={params} />
    </Suspense>
  );
}

function JournalEntryDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const highlightAccount = searchParams.get("account");
  const entry = useFetch(() => api.journalEntries.get(id), [id]);

  return (
    <AppShell>
      <AsyncState loading={entry.loading} error={entry.error} data={entry.data} onRetry={entry.reload}>
        {(data) => {
          const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
          const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);
          const sourceHref = SOURCE_HREF[data.source_type];

          return (
            <>
              <div className="page-head">
                <div>
                  <h1>{data.entry_number}</h1>
                  <p>
                    <StatusBadge status={data.state} /> · {data.journal_name ?? "—"} · {date(data.entry_date)}
                    {data.reference ? <> · {data.reference}</> : null}
                  </p>
                </div>
                {sourceHref && data.source_id ? (
                  <Link href={sourceHref(data.source_id)} className="btn btn-primary">
                    View source document
                  </Link>
                ) : null}
                <ClosePanel />
              </div>

              {data.reversal_of_id ? (
                <div className="alert alert-info">
                  This is a reversing entry — it offsets{" "}
                  <Link href={`/account/journal-entries/${data.reversal_of_id}`}>the original entry</Link> without
                  touching it. Both remain on record permanently.
                </div>
              ) : null}

              <div className="card">
                <div className="card-head"><span className="card-title">Lines</span></div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Label</th>
                        <th style={{ textAlign: "right" }}>Debit</th>
                        <th style={{ textAlign: "right" }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lines.map((line) => (
                        <tr key={line.id} className={line.account_id === highlightAccount ? "row-highlight" : undefined}>
                          <td>{line.account_code ? `${line.account_code} ${line.account_name ?? ""}` : line.account_name ?? "—"}</td>
                          <td>{line.label ?? "—"}</td>
                          <td className="num">{line.debit > 0 ? money(line.debit) : "—"}</td>
                          <td className="num">{line.credit > 0 ? money(line.credit) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} style={{ fontWeight: 700 }}>Total</td>
                        <td className="num" style={{ fontWeight: 700 }}>{money(totalDebit)}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{money(totalCredit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
                Source: {humanize(data.source_type)}
              </p>

              <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
                <Link href="/account/journal-entries">← Back to journal entries</Link>
              </p>
            </>
          );
        }}
      </AsyncState>
    </AppShell>
  );
}
