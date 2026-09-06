"use client";

import { useState } from "react";

import { Field } from "@/components/ui/field";
import type { Account, AccountCreate } from "@/lib/api";
import { accountSchema, fieldErrorsFrom, formMessageFrom, validate, type FieldErrors } from "@/lib/validation";

export interface AccountFormValues {
  code: string;
  name: string;
  type: Account["type"];
}

export function accountToFormValues(account: Account): AccountFormValues {
  return { code: account.code, name: account.name, type: account.type };
}

interface AccountFormProps {
  initial?: AccountFormValues;
  onSubmit: (values: AccountCreate) => Promise<void>;
  submitLabel: string;
  readOnly?: boolean;
}

const TYPE_OPTIONS: Account["type"][] = [
  "ASSET", "BANK", "CASH", "LIABILITY", "CAPITAL", "INCOME", "EXPENSE", "OTHER_EXPENSE",
];

export function AccountForm({ initial, onSubmit, submitLabel, readOnly }: AccountFormProps) {
  const [values, setValues] = useState<AccountFormValues>(initial ?? { code: "", name: "", type: "ASSET" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const result = validate(accountSchema, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(result.data);
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
        <Field label="Code" error={errors.code} required>
          {(props) => (
            <input
              {...props}
              className="input mono"
              disabled={readOnly}
              value={values.code}
              onChange={(event) => setValues((prev) => ({ ...prev, code: event.target.value }))}
            />
          )}
        </Field>
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
              onChange={(event) => setValues((prev) => ({ ...prev, type: event.target.value as Account["type"] }))}
            >
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
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
