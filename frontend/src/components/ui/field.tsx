"use client";

/**
 * Labelled form field with accessible error wiring.
 *
 * Handles: real <label for>, aria-invalid, aria-describedby, role="alert" on the
 * error, and a decorative (aria-hidden) required marker. Use this for EVERY input —
 * hand-rolled field markup is how forms end up inaccessible and inconsistent.
 */

import { useId } from "react";

interface FieldProps {
  label: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function Field({ label, children, error, hint, required }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {required ? <span className="field-required" aria-hidden="true">*</span> : null}
      </label>

      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}

      {hint && !error ? <span id={hintId} className="field-hint">{hint}</span> : null}
      {error ? <span id={errorId} className="field-error" role="alert">{error}</span> : null}
    </div>
  );
}
