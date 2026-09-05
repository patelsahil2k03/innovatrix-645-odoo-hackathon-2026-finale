"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { date, humanize } from "@/lib/format";

const PAGE_SIZE = 20;

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
  const accountId = searchParams.get("account_id");
  const accountLabel = searchParams.get("account_label");
  const from = searchParams.get("from");
  const fromLabel = searchParams.get("from_label");

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
                        <Link href={accountId ? `/account/journal-entries/${entry.id}?account=${accountId}` : `/account/journal-entries/${entry.id}`}>
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
    </AppShell>
  );
}
