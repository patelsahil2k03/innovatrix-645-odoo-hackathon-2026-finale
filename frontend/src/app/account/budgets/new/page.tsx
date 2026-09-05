"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Field } from "@/components/ui/field";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { api, type BudgetLine } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { budgetSchema, fieldErrorsFrom, formMessageFrom, validate, type FieldErrors } from "@/lib/validation";

interface DraftBudgetLine extends BudgetLine {
  key: string;
}
let seq = 0;
const emptyLine = (): DraftBudgetLine => ({ key: `bl-${++seq}`, analytic_account_id: "", committed_amount: 0 });

export default function NewBudgetPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [lines, setLines] = useState<DraftBudgetLine[]>([emptyLine()]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const contacts = useFetch(() => api.contacts.list({ page_size: 200, sort: "name" }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 200, sort: "name" }), []);

  function updateLine(key: string, patch: Partial<BudgetLine>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function handleSubmit(event: React.FormEvent) {
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
      const created = await api.budgets.create({ ...result.data, responsible_id: result.data.responsible_id ?? null });
      router.push(`/account/budgets/${created.id}`);
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      setFormError(formMessageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>New budget</h1>
          <p>Only the committed amount is stored — achieved figures are computed on read.</p>
        </div>
      </div>

      <form className="stack" onSubmit={handleSubmit} noValidate>
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
                    <tr key={line.key}>
                      <td>
                        <select
                          className="select"
                          aria-label="Analytic account"
                          value={line.analytic_account_id}
                          onChange={(event) => updateLine(line.key, { analytic_account_id: event.target.value })}
                        >
                          <option value="">Select an analytic account…</option>
                          {(analyticAccounts.data?.items ?? []).map((a) => (
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
                          onChange={(event) => updateLine(line.key, { committed_amount: Number(event.target.value) })}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== line.key)))}
                          disabled={lines.length <= 1}
                          aria-label="Remove line"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {errors.lines ? <span className="field-error" role="alert">{errors.lines}</span> : null}
          <button type="button" className="btn btn-sm" onClick={() => setLines((prev) => [...prev, emptyLine()])} style={{ alignSelf: "flex-start" }}>
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
