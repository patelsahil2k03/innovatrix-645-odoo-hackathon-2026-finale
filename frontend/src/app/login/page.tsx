"use client";

import { useState } from "react";

import { Field } from "@/components/ui/field";
import { useAuth } from "@/lib/auth-context";
import { formMessageFrom, loginSchema, validate, type FieldErrors } from "@/lib/validation";

/** ★ Replace with the demo accounts your seed script creates. */
const DEMO_ACCOUNTS = [
  { email: "admin@demo.in", label: "Administrator" },
  { email: "manager@demo.in", label: "Manager" },
  { email: "operator@demo.in", label: "Operator" },
  { email: "viewer@demo.in", label: "Viewer" },
];
const DEMO_PASSWORD = "Demo@1234";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    // Client-side validation first — inline errors, never a browser popup.
    const result = validate(loginSchema, { email, password });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      await login(result.data.email, result.data.password);
    } catch (error) {
      setFormError(formMessageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemoAccount(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setErrors({});
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div>
          <h1 style={{ fontSize: "var(--t-xl)" }}>Sign in</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginTop: 4 }}>
            Use a demo account below, or enter your credentials.
          </p>
        </div>

        <form className="card stack" onSubmit={handleSubmit} noValidate>
          {formError ? <div className="alert alert-danger" role="alert">{formError}</div> : null}

          <Field label="Email" error={errors.email} required>
            {(props) => (
              <input
                {...props}
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>

          <Field label="Password" error={errors.password} required>
            {(props) => (
              <input
                {...props}
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="card">
          <div className="card-head">
            <span className="card-title" style={{ fontSize: "var(--t-sm)" }}>Demo accounts</span>
          </div>
          <div className="row">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="btn btn-sm"
                onClick={() => fillDemoAccount(account.email)}
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
