"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, Suspense, useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { AsyncState } from "@/components/ui/async-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { BudgetDonut } from "@/components/ui/budget-donut";
import { Drawer } from "@/components/ui/drawer";
import { DrillAmount } from "@/components/ui/drill-amount";
import { Field } from "@/components/ui/field";
import { KanbanGrid } from "@/components/ui/kanban";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusChips } from "@/components/ui/status-chips";
import { ViewToggle, type ListView } from "@/components/ui/view-toggle";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { api, type AnalyticAccount, type BudgetLine } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { aggregateBudgetLines, budgetAchievedTone } from "@/lib/budget-helpers";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useDrawerParam } from "@/lib/use-drawer-param";
import { useStatusFilter } from "@/lib/use-status-counts";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { budgetSchema, fieldErrorsFrom, formMessageFrom, validate, type FieldErrors } from "@/lib/validation";
import { date, money, percent } from "@/lib/format";
import { can } from "@/lib/roles";

const PAGE_SIZE = 20;

interface DraftBudgetLine extends BudgetLine {
  key: string;
}
let seq = 0;
const emptyLine = (): DraftBudgetLine => ({ key: `bl-${++seq}`, analytic_account_id: "", committed_amount: 0 });

interface BudgetLineRowProps {
  line: DraftBudgetLine;
  analyticAccounts: AnalyticAccount[];
  removeDisabled: boolean;
  onUpdate: (key: string, patch: Partial<BudgetLine>) => void;
  onRemove: (key: string) => void;
}

const BudgetLineRow = memo(function BudgetLineRow({
  line, analyticAccounts, removeDisabled, onUpdate, onRemove,
}: BudgetLineRowProps) {
  const handleAccountChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => onUpdate(line.key, { analytic_account_id: event.target.value }),
    [line.key, onUpdate],
  );
  const handleAmountChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onUpdate(line.key, { committed_amount: Number(event.target.value) }),
    [line.key, onUpdate],
  );
  const handleRemove = useCallback(() => onRemove(line.key), [line.key, onRemove]);

  return (
    <tr>
      <td>
        <select
          className="select"
          aria-label="Analytic account"
          value={line.analytic_account_id}
          onChange={handleAccountChange}
        >
          <option value="">Select an analytic account…</option>
          {analyticAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
          ))}
        </select>
      </td>
      <td className="num">
        <input
          className="input tabular"
          style={{ textAlign: "right" }}
          type="number" min={0} step="0.01"
          aria-label="Committed amount"
          value={line.committed_amount}
          onChange={handleAmountChange}
        />
      </td>
      <td>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleRemove}
          disabled={removeDisabled}
          aria-label="Remove line"
        >
          <TrashIcon size={14} />
        </button>
      </td>
    </tr>
  );
});

export default function BudgetsPage() {
  return (
    <Suspense fallback={null}>
      <BudgetsPageInner />
    </Suspense>
  );
}

function BudgetsPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const panel = useDrawerParam();
  const statusFilter = useStatusFilter("budgets");
  const [view, setView] = useState<ListView>("list");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const budgets = useFetch(
    () => api.budgets.list({ page, page_size: PAGE_SIZE, q: debouncedSearch, sort: "-period_start" , state: statusFilter.status ?? undefined }),
    [page, debouncedSearch, statusFilter.status],
  );

  // Same render-time reset as the document lists: a narrower filter can leave
  // the current page past the last one, showing an empty table for real rows.
  const [filteredBy, setFilteredBy] = useState(statusFilter.status);
  if (filteredBy !== statusFilter.status) {
    setFilteredBy(statusFilter.status);
    setPage(1);
  }

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const canRecord = can.record(user?.role.name);

  const rowsWithAggregate = useMemo(
    () => (budgets.data?.items ?? []).map((budget) => ({ budget, aggregate: aggregateBudgetLines(budget.lines) })),
    [budgets.data],
  );

  const kanbanItems = useMemo(
    () =>
      rowsWithAggregate.map(({ budget, aggregate }) => ({
        id: budget.id,
        title: budget.name,
        subtitle: `${date(budget.period_start)} – ${date(budget.period_end)}`,
        meta: budget.responsible_name ?? undefined,
        href: panel.hrefFor(budget.id),
        badge: <BudgetDonut achievedPct={aggregate.achievedPct} size={44} />,
      })),
    [rowsWithAggregate, panel],
  );

  // Fetched by id rather than read off the currently loaded page, so
  // `?open=<id>` stays a real, reloadable link regardless of search/sort/page
  // — including the revision-chain links (budget → its revision/original).
  const editingId = panel.openId;
  const editingBudget = useFetch(
    () => (editingId ? api.budgets.get(editingId) : Promise.resolve(null)),
    [editingId],
  );

  // ── Create drawer ────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [lines, setLines] = useState<DraftBudgetLine[]>([emptyLine()]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const contacts = useFetch(() => api.contacts.list({ page_size: 100, sort: "name" }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 100, sort: "name" }), []);

  const updateLine = useCallback((key: string, patch: Partial<BudgetLine>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }, []);
  const removeLine = useCallback((key: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }, []);
  const addLine = useCallback(() => setLines((prev) => [...prev, emptyLine()]), []);

  function resetCreateForm() {
    setName("");
    setPeriodStart("");
    setPeriodEnd("");
    setResponsibleId("");
    setLines([emptyLine()]);
    setErrors({});
    setFormError(null);
  }

  const handleSubmit = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const result = validate(budgetSchema, {
      name,
      period_start: periodStart,
      period_end: periodEnd,
      responsible_id: responsibleId || null,
      lines: lines.map(({ analytic_account_id, committed_amount }) => ({ analytic_account_id, committed_amount })),
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await api.budgets.create({ ...result.data, responsible_id: result.data.responsible_id ?? null });
      toast.success("Budget created");
      resetCreateForm();
      panel.close();
      budgets.reload();
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      setFormError(formMessageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }, [name, periodStart, periodEnd, responsibleId, lines, panel, toast, budgets]);

  // ── View drawer — lifecycle actions ─────────────────────────────────────
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    if (!editingId) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.budgets.confirm(editingId);
      editingBudget.reload();
      budgets.reload();
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const handleRevise = useCallback(async () => {
    if (!editingId) return;
    setWorking(true);
    setActionError(null);
    try {
      const revised = await api.budgets.revise(editingId);
      panel.close();
      router.push(`/account/budgets?open=${revised.id}`);
    } catch (error) {
      setActionError(formMessageFrom(error));
      setWorking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, router]);

  const handleCancel = useCallback(async () => {
    if (!editingId) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.budgets.cancel(editingId);
      editingBudget.reload();
      budgets.reload();
    } catch (error) {
      setActionError(formMessageFrom(error));
    } finally {
      setWorking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Analytical Budget" }]} />
      <div className="page-head">
        <div>
          <h1>Analytical Budget</h1>
          <p>Planned vs. achieved, by analytic account and period.</p>
        </div>
        {canRecord ? (
          <Link href={panel.hrefFor("new")} className="btn btn-primary">
            <PlusIcon size={14} />
            New budget
          </Link>
        ) : null}
      </div>

      <div className="row-between">
        <SearchInput value={search} onChange={handleSearchChange} label="Search budgets" />

        <StatusChips
          chips={statusFilter.chips}
          active={statusFilter.status}
          hrefFor={statusFilter.hrefFor}
          aria-label="Budgets by state"
        />
        <ViewToggle value={view} onChange={setView} />
      </div>

      <div className="card">
        <AsyncState
          loading={budgets.loading}
          error={budgets.error}
          data={budgets.data}
          isEmpty={(p) => p.items.length === 0}
          emptyTitle="No budgets yet"
          onRetry={budgets.reload}
          skeleton={<SkeletonTable rows={6} columns={5} />}
        >
          {() =>
            view === "list" ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Name</th><th>Period</th><th>Responsible</th><th>State</th><th>Achieved</th></tr>
                  </thead>
                  <tbody>
                    {rowsWithAggregate.map(({ budget, aggregate }) => (
                      <tr key={budget.id}>
                        <td><Link href={panel.hrefFor(budget.id)}>{budget.name}</Link></td>
                        <td>{date(budget.period_start)} – {date(budget.period_end)}</td>
                        <td>{budget.responsible_name ?? "—"}</td>
                        <td><StatusBadge status={budget.state} /></td>
                        <td><BudgetDonut achievedPct={aggregate.achievedPct} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <KanbanGrid items={kanbanItems} />
            )
          }
        </AsyncState>

        {budgets.data ? (
          <Pagination page={budgets.data.page} pages={budgets.data.pages} total={budgets.data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
        ) : null}
      </div>

      <Drawer
        open={panel.isNew}
        onClose={() => { resetCreateForm(); panel.close(); }}
        title="New budget"
       
        footer={
          <button type="submit" form="new-budget-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save budget"}
          </button>
        }
      >
        <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
          Only the committed amount is stored — achieved figures are computed on read.
        </p>
        <form id="new-budget-form" className="stack" onSubmit={handleSubmit} noValidate>
          {formError ? <div className="alert alert-danger" role="alert">{formError}</div> : null}

          <div className="card grid-2">
            <Field label="Name" error={errors.name} required>
              {(props) => <input {...props} className="input" value={name} onChange={(event) => setName(event.target.value)} />}
            </Field>
            <Field label="Responsible" hint="Selected from Contacts, not internal users">
              {(props) => (
                <select {...props} className="select" value={responsibleId} onChange={(event) => setResponsibleId(event.target.value)}>
                  <option value="">—</option>
                  {(contacts.data?.items ?? []).map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.name}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Period start" error={errors.period_start} required>
              {(props) => <input {...props} className="input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />}
            </Field>
            <Field label="Period end" error={errors.period_end} required>
              {(props) => <input {...props} className="input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />}
            </Field>
          </div>

          <div className="card stack">
            <div className="card-head"><span className="card-title">Budget lines</span></div>
            <div className="table-wrap">
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Analytic account</th><th style={{ textAlign: "right" }}>Committed amount</th><th aria-label="Remove line" /></tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <BudgetLineRow
                        key={line.key}
                        line={line}
                        analyticAccounts={analyticAccounts.data?.items ?? []}
                        removeDisabled={lines.length <= 1}
                        onUpdate={updateLine}
                        onRemove={removeLine}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {errors.lines ? <span className="field-error" role="alert">{errors.lines}</span> : null}
            <button type="button" className="btn btn-sm" onClick={addLine} style={{ alignSelf: "flex-start" }}>
              <PlusIcon size={14} />
              Add a line
            </button>
          </div>
        </form>
      </Drawer>

      <Drawer
        open={panel.openId !== null}
        onClose={panel.close}
        title={editingBudget.data?.name ?? "Budget"}
       
        footer={
          editingBudget.data && canRecord ? (
            <>
              {editingBudget.data.state === "DRAFT" ? (
                <button type="button" className="btn" onClick={handleCancel} disabled={working}>Cancel</button>
              ) : null}
              {editingBudget.data.state === "DRAFT" ? (
                <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={working}>Confirm</button>
              ) : null}
              {editingBudget.data.state === "CONFIRMED" ? (
                <button type="button" className="btn btn-primary" onClick={handleRevise} disabled={working}>Revise</button>
              ) : null}
            </>
          ) : null
        }
      >
        <AsyncState
          loading={editingBudget.loading}
          error={editingBudget.error}
          data={editingBudget.data}
          onRetry={editingBudget.reload}
          skeleton={<SkeletonCard lines={5} />}
        >
          {(data) => (
            <>
              <p>
                <StatusBadge status={data.state} /> · {date(data.period_start)} – {date(data.period_end)}
                {data.responsible_name ? <> · {data.responsible_name}</> : null}
              </p>

              {actionError ? <div className="alert alert-danger" role="alert">{actionError}</div> : null}

              {data.revision_of_id ? (
                <div className="alert alert-info">
                  This is a revision of <Link href={panel.hrefFor(data.revision_of_id)}>an earlier budget</Link>.
                </div>
              ) : null}
              {data.revised_with_id ? (
                <div className="alert alert-info">
                  Superseded by <Link href={panel.hrefFor(data.revised_with_id)}>its revision</Link> — this
                  budget&apos;s own figures stay exactly as they were.
                </div>
              ) : null}

              <div className="card">
                <div className="card-head"><span className="card-title">Budget lines</span></div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Analytic account</th>
                        <th style={{ textAlign: "right" }}>Committed</th>
                        <th style={{ textAlign: "right" }}>Achieved</th>
                        <th style={{ textAlign: "right" }}>Achieved %</th>
                        <th style={{ textAlign: "right" }}>To achieve</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lines.map((line) => (
                        <tr key={line.id}>
                          <td>{line.analytic_account_name ?? "—"}</td>
                          <td className="num">{money(line.committed_amount)}</td>
                          <td className="num">
                            {line.id ? (
                              <DrillAmount
                                value={line.achieved_amount ?? 0}
                                href={`/account/budgets/${data.id}/lines/${line.id}/documents`}
                              />
                            ) : (
                              money(line.achieved_amount ?? 0)
                            )}
                          </td>
                          <td className="num">
                            <span className={`badge badge-${budgetAchievedTone(line.achieved_pct ?? 0)}`}>
                              {percent(line.achieved_pct ?? 0)}
                            </span>
                          </td>
                          <td className="num">{money(line.amount_to_achieve ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </AsyncState>
      </Drawer>
    </AppShell>
  );
}
