"use client";

/**
 * Self-registration — always creates an Accountant (04_API_CONTRACT.md §3.0).
 * Admin and portal accounts are created by an Admin, never by self-registration,
 * so this form has no role picker at all.
 */

import Link from "next/link";
import { useState } from "react";

import { Field } from "@/components/ui/field";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  fieldErrorsFrom,
  formMessageFrom,
  signupSchema,
  validate,
  type FieldErrors,
} from "@/lib/validation";

export default function SignupPage() {
  const { login } = useAuth();
  const [values, setValues] = useState({ login_id: "", email: "", full_name: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField(field: keyof typeof values, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const result = validate(signupSchema, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      await api.auth.signup(result.data);
      await login(result.data.email, result.data.password);
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      setFormError(formMessageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div>
          <h1 style={{ fontSize: "var(--t-xl)" }}>Create an account</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginTop: 4 }}>
            Self-registration always creates an Accountant. Admin and portal accounts are set
            up by an Admin.
          </p>
        </div>

        <form className="card stack" onSubmit={handleSubmit} noValidate>
          {formError ? <div className="alert alert-danger" role="alert">{formError}</div> : null}

          <Field label="Full name" error={errors.full_name} required>
            {(props) => (
              <input
                {...props}
                className="input"
                autoComplete="name"
                value={values.full_name}
                onChange={(event) => setField("full_name", event.target.value)}
              />
            )}
          </Field>

          <Field label="Login ID" error={errors.login_id} hint="6–12 characters" required>
            {(props) => (
              <input
                {...props}
                className="input"
                autoComplete="username"
                value={values.login_id}
                onChange={(event) => setField("login_id", event.target.value)}
              />
            )}
          </Field>

          <Field label="Email" error={errors.email} required>
            {(props) => (
              <input
                {...props}
                className="input"
                type="email"
                autoComplete="email"
                value={values.email}
                onChange={(event) => setField("email", event.target.value)}
              />
            )}
          </Field>

          <Field
            label="Password"
            error={errors.password}
            hint="More than 8 characters, with a lowercase, an uppercase and a special character"
            required
          >
            {(props) => (
              <input
                {...props}
                className="input"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(event) => setField("password", event.target.value)}
              />
            )}
          </Field>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>

          <p style={{ textAlign: "center", fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
