"use client";

import { usePathname, useRouter } from "next/navigation";
import { memo, useCallback, useState, type ChangeEvent, type FormEvent } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Field } from "@/components/ui/field";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { ClosePanel } from "@/components/ui/close-panel";
import { api, type AnalyticAccount, type BudgetLine } from "@/lib/api";
import { parentRouteOf } from "@/lib/use-close-panel";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { budgetSchema, fieldErrorsFrom, formMessageFrom, validate, type FieldErrors } from "@/lib/validation";

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

export default function NewBudgetPage() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
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

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    [],
  );
  const handleResponsibleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => setResponsibleId(event.target.value),
    [],
  );
  const handlePeriodStartChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setPeriodStart(event.target.value),
    [],
  );
  const handlePeriodEndChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setPeriodEnd(event.target.value),
    [],
  );

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
      router.push(parentRouteOf(pathname ?? "/"));
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      setFormError(formMessageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }, [name, periodStart, periodEnd, responsibleId, lines, router, pathname, toast]);

  return (
    <AppShell>
      <Breadcrumbs items={[{ label: "Account" }, { label: "Analytical Budget", href: "/account/budgets" }, { label: "New" }]} />
      <div className="page-head">
        <div>
          <h1>New budget</h1>
          <p>Only the committed amount is stored — achieved figures are computed on read.</p>
        </div>
        <ClosePanel />
      </div>

      <form className="stack" onSubmit={handleSubmit} noValidate>
        {formError ? <div className="alert alert-danger" role="alert">{formError}</div> : null}

        <div className="card grid-2">
          <Field label="Name" error={errors.name} required>
            {(props) => <input {...props} className="input" value={name} onChange={handleNameChange} />}
          </Field>
          <Field label="Responsible" hint="Selected from Contacts, not internal users">
            {(props) => (
              <select {...props} className="select" value={responsibleId} onChange={handleResponsibleChange}>
                <option value="">—</option>
                {(contacts.data?.items ?? []).map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.name}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Period start" error={errors.period_start} required>
            {(props) => <input {...props} className="input" type="date" value={periodStart} onChange={handlePeriodStartChange} />}
          </Field>
          <Field label="Period end" error={errors.period_end} required>
            {(props) => <input {...props} className="input" type="date" value={periodEnd} onChange={handlePeriodEndChange} />}
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

        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ alignSelf: "flex-start" }}>
          {submitting ? "Saving…" : "Save budget"}
        </button>
      </form>
    </AppShell>
  );
}
