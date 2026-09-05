"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Drawer } from "@/components/ui/drawer";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useDrawerParam } from "@/lib/use-drawer-param";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { date, humanize, money } from "@/lib/format";

const PAGE_SIZE = 20;

const SOURCE_HREF: Partial<Record<string, (sourceId: string) => string>> = {
  customer_invoice: (id) => `/sales/invoices?open=${id}`,
  vendor_bill: (id) => `/purchase/bills?open=${id}`,
};

/**
 * Read-only, and that is the point (04_API_CONTRACT.md §3.7) — there is no
 * create/edit here. Entries only ever exist as the side effect of posting a
 * document, and corrections happen through /cancel, which writes a reversing
 * entry, never an edit.
 */
export default function JournalEntriesPage() {
  return (
    <Suspense fallback={null}>
      <JournalEntriesPageInner />
    </Suspense>
  );
}

function JournalEntriesPageInner() {
  const searchParams = useSearchParams();
  const panel = useDrawerParam();
  const accountId = searchParams.get("account_id");
  const accountLabel = searchParams.get("account_label");
  const from = searchParams.get("from");
  const fromLabel = searchParams.get("from_label");
  // Which line to highlight inside the opened entry — separate from
  // `account_id` above, which filters the list itself.
  const highlightAccount = searchParams.get("account");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("-entry_date");
  const debouncedSearch = useDebouncedValue(search, 300);

  const entries = useFetch(
    () =>
      api.journalEntries.list({
        page,
        page_size: PAGE_SIZE,
        q: debouncedSearch,
        sort: sort ?? undefined,
        account_id: accountId ?? undefined,
      }),
    [page, debouncedSearch, sort, accountId],
  );
  useEventStream({
    "document.posted": () => entries.reload(),
    "payment.registered": () => entries.reload(),
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  // Fetched by id rather than read off the currently loaded page, so
  // `?open=<id>` stays a real, reloadable link regardless of search/sort/page
  // — including links in from the dashboard, reports, invoices and bills.
  const editingId = panel.openId;
  const openEntry = useFetch(
    () => (editingId ? api.journalEntries.get(editingId) : Promise.resolve(null)),
    [editingId],
  );

  return (
    <AppShell>
      <Breadcrumbs
        items={
          from && fromLabel
            ? [{ label: fromLabel, href: from }, { label: accountLabel ?? "Journal lines" }]
            : [{ label: "Account" }, { label: "Journal Entries" }]
        }
      />

      <div className="page-head">
        <div>
          <h1>{accountLabel ? `Journal entries — ${accountLabel}` : "Journal Entries"}</h1>
          <p>The ledger itself — read-only. Corrections are a reversing entry, never an edit.</p>
        </div>
      </div>

      <SearchInput value={search} onChange={handleSearchChange} label="Search journal entries" placeholder="Search by entry number or reference" />

      <div className="card">
        <AsyncState
          loading={entries.loading}
          error={entries.error}
          data={entries.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="Nothing posted yet"
          onRetry={entries.reload}
          skeleton={<SkeletonTable rows={6} columns={6} />}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Entry</th>
                    <SortableTh label="Date" sortKey="entry_date" current={sort} onSort={setSort} />
                    <th>Journal</th>
                    <th>Reference</th>
                    <th>Source</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((entry) => (
                    <tr key={entry.id}>
                      <td className="mono">
                        <Link href={accountId ? `${panel.hrefFor(entry.id)}&account=${accountId}` : panel.hrefFor(entry.id)}>
                          {entry.entry_number}
                        </Link>
                      </td>
                      <td>{date(entry.entry_date)}</td>
                      <td>{entry.journal_name ?? "—"}</td>
                      <td>{entry.reference ?? "—"}</td>
                      <td>{humanize(entry.source_type)}</td>
                      <td><StatusBadge status={entry.state} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>

        {entries.data ? (
          <Pagination page={entries.data.page} pages={entries.data.pages} total={entries.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>

      <Drawer open={panel.openId !== null} onClose={panel.close} title={openEntry.data?.entry_number ?? "Journal entry"} width={55}>
        <AsyncState loading={openEntry.loading} error={openEntry.error} data={openEntry.data} onRetry={openEntry.reload} skeleton={<SkeletonCard lines={5} />}>
          {(data) => {
            const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
            const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);
            const sourceHref = SOURCE_HREF[data.source_type];

            return (
              <>
                <p>
                  <StatusBadge status={data.state} /> · {data.journal_name ?? "—"} · {date(data.entry_date)}
                  {data.reference ? <> · {data.reference}</> : null}
                </p>

                {sourceHref && data.source_id ? (
                  <p>
                    <Link href={sourceHref(data.source_id)} className="btn btn-primary">
                      View source document
                    </Link>
                  </p>
                ) : null}

                {data.reversal_of_id ? (
                  <div className="alert alert-info">
                    This is a reversing entry — it offsets{" "}
                    <Link href={panel.hrefFor(data.reversal_of_id)}>the original entry</Link> without
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
              </>
            );
          }}
        </AsyncState>
      </Drawer>
    </AppShell>
  );
}
