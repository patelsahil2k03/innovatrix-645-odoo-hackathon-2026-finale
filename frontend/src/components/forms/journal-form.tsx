"use client";

import { useState } from "react";

import { Field } from "@/components/ui/field";
import { api, type Account, type Journal, type JournalCreate } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { fieldErrorsFrom, formMessageFrom, journalSchema, validate, type FieldErrors } from "@/lib/validation";

export interface JournalFormValues {
  name: string;
  type: Journal["type"];
  default_debit_account_id: string;
  default_credit_account_id: string;
}

export function journalToFormValues(journal: Journal): JournalFormValues {
  return {
    name: journal.name,
    type: journal.type,
    default_debit_account_id: journal.default_debit_account_id ?? "",
    default_credit_account_id: journal.default_credit_account_id ?? "",
  };
}

interface JournalFormProps {
  initial?: JournalFormValues;
  onSubmit: (values: JournalCreate) => Promise<void>;
  submitLabel: string;
  readOnly?: boolean;
}

function accountLabel(account: Account): string {
  return `${account.code} — ${account.name}`;
}

export function JournalForm({ initial, onSubmit, submitLabel, readOnly }: JournalFormProps) {
  const [values, setValues] = useState<JournalFormValues>(
    initial ?? { name: "", type: "BANK", default_debit_account_id: "", default_credit_account_id: "" },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const accounts = useFetch(() => api.accounts.list({ page_size: 200, sort: "code" }), []);
  const accountOptions = accounts.data?.items ?? [];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const result = validate(journalSchema, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit({
        name: result.data.name,
        type: result.data.type,
        default_debit_account_id: values.default_debit_account_id || null,
        default_credit_account_id: values.default_credit_account_id || null,
      });
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      setFormError(formMessageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card stack" onSubmit={handleSubmit} noValidate>
      {formError ? <div className="alert alert-danger" role="alert">{formError}</div> : null}
      <div className="grid-2">
        <Field label="Name" error={errors.name} required>
          {(props) => (
            <input
              {...props}
              className="input"
              disabled={readOnly}
              value={values.name}
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            />
          )}
        </Field>
        <Field label="Type" error={errors.type} required>
          {(props) => (
            <select
              {...props}
              className="select"
              disabled={readOnly}
              value={values.type}
              onChange={(event) => setValues((prev) => ({ ...prev, type: event.target.value as Journal["type"] }))}
            >
              <option value="SALES">Sales</option>
              <option value="PURCHASE">Purchase</option>
              <option value="BANK">Bank</option>
              <option value="CASH">Cash</option>
              <option value="MISC">Misc</option>
            </select>
          )}
        </Field>
        <Field label="Default debit account" hint="For Bank/Cash journals, this is the money account">
          {(props) => (
            <select
              {...props}
              className="select"
              disabled={readOnly}
              value={values.default_debit_account_id}
              onChange={(event) => setValues((prev) => ({ ...prev, default_debit_account_id: event.target.value }))}
            >
              <option value="">—</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>{accountLabel(account)}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Default credit account">
          {(props) => (
            <select
              {...props}
              className="select"
              disabled={readOnly}
              value={values.default_credit_account_id}
              onChange={(event) => setValues((prev) => ({ ...prev, default_credit_account_id: event.target.value }))}
            >
              <option value="">—</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>{accountLabel(account)}</option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {readOnly ? null : (
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ alignSelf: "flex-start" }}>
          {submitting ? "Saving…" : submitLabel}
        </button>
      )}
    </form>
  );
}
