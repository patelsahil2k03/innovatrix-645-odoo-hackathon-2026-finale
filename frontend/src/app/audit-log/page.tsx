"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeading } from "@/components/ui/page-heading";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonTable } from "@/components/ui/skeleton";
import { SortableTh } from "@/components/ui/sortable-th";
import { api } from "@/lib/api";
import {
  actorLabel,
  auditEntityHref,
  describeAction,
  entityLabel,
  wasAccepted,
} from "@/lib/audit-view";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";
import { dateTime } from "@/lib/format";

const PAGE_SIZE = 20;

const OUTCOMES = [
  { value: null, label: "All" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
] as const;

type Outcome = (typeof OUTCOMES)[number]["value"];

/**
 * Who did what, when — admin only (`docs/04_API_CONTRACT.md` §2, enforced
 * server-side by `require_admin`).
 *
 * The API now joins the acting user, so this shows a name where it used to
 * print a raw UUID, and every row that points at a record links to it.
 */
export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>("-created_at");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [entity, setEntity] = useState<string>("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const logs = useFetch(
    () =>
      api.auditLogs.list({
        page,
        page_size: PAGE_SIZE,
        q: debouncedSearch,
        sort: sort ?? undefined,
        outcome: outcome ?? undefined,
        entity_name: entity || undefined,
      }),
    [page, debouncedSearch, sort, outcome, entity],
  );
  const entities = useFetch(() => api.auditLogs.entities(), []);

  // Every accepted write lands here the moment it happens, so the screen that
  // reports activity should not be the one screen that needs a manual reload.
  useEventStream({
    "document.posted": () => logs.reload(),
    "payment.registered": () => logs.reload(),
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const changeOutcome = useCallback((value: Outcome) => {
    setOutcome(value);
    setPage(1);
  }, []);

  const changeEntity = useCallback((value: string) => {
    setEntity(value);
    setPage(1);
  }, []);

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Audit log" }]} />
      <PageHeading
        image="/img/tabs/audit-log.webp"
        title="Audit log"
        subtitle="Every write the API accepted or refused — who, what, and the answer it gave."
      />

      <SearchInput
        value={search}
        onChange={handleSearchChange}
        label="Search audit log"
        placeholder="Search by action or entity"
      />

      <div className="filter-bar">
        <div className="chart-switch" role="group" aria-label="Outcome">
          {OUTCOMES.map((option) => (
            <button
              key={option.label}
              type="button"
              className="chart-switch-btn"
              aria-pressed={outcome === option.value}
              onClick={() => changeOutcome(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <select
          className="select"
          aria-label="Filter by module"
          value={entity}
          onChange={(event) => changeEntity(event.target.value)}
        >
          <option value="">All modules</option>
          {(entities.data ?? []).map((name) => (
            <option key={name} value={name}>
              {entityLabel(name)}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <AsyncState
          loading={logs.loading}
          error={logs.error}
          data={logs.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="Nothing matches"
          emptyHint="Every accepted or refused write shows up here as soon as it happens."
          onRetry={logs.reload}
          skeleton={<SkeletonTable rows={6} columns={5} />}
        >
          {(pageData) => (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableTh label="When" sortKey="created_at" current={sort} onSort={setSort} />
                    <th>Who</th>
                    <th>Did what</th>
                    <SortableTh label="To" sortKey="entity_name" current={sort} onSort={setSort} />
                    <SortableTh label="Result" sortKey="status_code" current={sort} onSort={setSort} />
                  </tr>
                </thead>
                <tbody>
                  {pageData.items.map((row) => {
                    const href = auditEntityHref(row);
                    const accepted = wasAccepted(row);
                    return (
                      <tr key={row.id}>
                        <td>{dateTime(row.created_at)}</td>
                        <td>{actorLabel(row)}</td>
                        <td>{describeAction(row.action)}</td>
                        <td>
                          {href ? (
                            <Link href={href}>{entityLabel(row.entity_name)}</Link>
                          ) : (
                            entityLabel(row.entity_name)
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${accepted ? "badge-ok" : "badge-danger"}`}
                            title={`HTTP ${row.status_code}`}
                          >
                            {accepted ? "Accepted" : "Refused"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AsyncState>

        {logs.data ? (
          <Pagination
            page={logs.data.page}
            pages={logs.data.pages}
            total={logs.data.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
