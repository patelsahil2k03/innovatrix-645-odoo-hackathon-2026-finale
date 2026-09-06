"use client";

import { useState } from "react";

import { Field } from "@/components/ui/field";
import type { AnalyticAccount, AnalyticAccountCreate } from "@/lib/api";
import {
  analyticAccountSchema,
  fieldErrorsFrom,
  formMessageFrom,
  validate,
  type FieldErrors,
} from "@/lib/validation";

export interface AnalyticAccountFormValues {
  name: string;
  type: AnalyticAccount["type"];
}

export function analyticAccountToFormValues(row: AnalyticAccount): AnalyticAccountFormValues {
  return { name: row.name, type: row.type };
}

interface AnalyticAccountFormProps {
  initial?: AnalyticAccountFormValues;
  onSubmit: (values: AnalyticAccountCreate) => Promise<void>;
  submitLabel: string;
  readOnly?: boolean;
}

export function AnalyticAccountForm({ initial, onSubmit, submitLabel, readOnly }: AnalyticAccountFormProps) {
  const [values, setValues] = useState<AnalyticAccountFormValues>(initial ?? { name: "", type: "EXPENSE" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const result = validate(analyticAccountSchema, values);
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
        <Field label="Type" error={errors.type} required hint="Which side of a document this tags — income lines or expense lines">
          {(props) => (
            <select
              {...props}
              className="select"
              disabled={readOnly}
              value={values.type}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, type: event.target.value as AnalyticAccount["type"] }))
              }
            >
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
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
