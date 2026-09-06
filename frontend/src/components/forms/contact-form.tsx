"use client";

/**
 * Create/edit form shared by /account/contacts/new and /account/contacts/[id].
 * Field rules mirror contactSchema in lib/validation.ts, which mirrors the
 * server (03_DATA_MODEL.md §2).
 */

import { useState } from "react";

import { Field } from "@/components/ui/field";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { api, type Account, type Contact, type ContactCreate } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { contactSchema, fieldErrorsFrom, formMessageFrom, validate, type FieldErrors } from "@/lib/validation";

export interface ContactFormValues {
  name: string;
  type: Contact["type"];
  email: string;
  mobile: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_country: string;
  address_pincode: string;
  receivable_account_id: string;
  payable_account_id: string;
}

const BLANK: ContactFormValues = {
  name: "",
  type: "CUSTOMER",
  email: "",
  mobile: "",
  address_street: "",
  address_city: "",
  address_state: "",
  address_country: "India",
  address_pincode: "",
  receivable_account_id: "",
  payable_account_id: "",
};

export function contactToFormValues(contact: Contact): ContactFormValues {
  return {
    name: contact.name,
    type: contact.type,
    email: contact.email ?? "",
    mobile: contact.mobile ?? "",
    address_street: contact.address_street ?? "",
    address_city: contact.address_city ?? "",
    address_state: contact.address_state ?? "",
    address_country: contact.address_country ?? "India",
    address_pincode: contact.address_pincode ?? "",
    receivable_account_id: contact.receivable_account_id ?? "",
    payable_account_id: contact.payable_account_id ?? "",
  };
}

interface ContactFormProps {
  initial?: ContactFormValues;
  onSubmit: (values: ContactCreate) => Promise<void>;
  submitLabel: string;
  readOnly?: boolean;
}

function accountLabel(account: Account): string {
  return `${account.code} — ${account.name}`;
}

export function ContactForm({ initial, onSubmit, submitLabel, readOnly }: ContactFormProps) {
  const [values, setValues] = useState<ContactFormValues>(initial ?? BLANK);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const accounts = useFetch(() => api.accounts.list({ page_size: 100, sort: "code" }), []);

  function setField<K extends keyof ContactFormValues>(field: K, value: ContactFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const result = validate(contactSchema, values);
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
        email: result.data.email || null,
        mobile: result.data.mobile || null,
        address_street: result.data.address_street || null,
        address_city: result.data.address_city || null,
        address_state: result.data.address_state || null,
        address_country: result.data.address_country || "India",
        address_pincode: result.data.address_pincode || null,
        image_url: null,
        receivable_account_id: values.receivable_account_id || null,
        payable_account_id: values.payable_account_id || null,
      });
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      setFormError(formMessageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  const accountOptions = accounts.data?.items ?? [];

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
              onChange={(event) => setField("name", event.target.value)}
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
              onChange={(event) => setField("type", event.target.value as Contact["type"])}
            >
              <option value="CUSTOMER">Customer</option>
              <option value="VENDOR">Vendor</option>
              <option value="BOTH">Both</option>
            </select>
          )}
        </Field>

        <Field label="Email" error={errors.email}>
          {(props) => (
            <input
              {...props}
              className="input"
              type="email"
              disabled={readOnly}
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
            />
          )}
        </Field>

        <Field label="Mobile" error={errors.mobile}>
          {(props) => (
            <input
              {...props}
              className="input"
              disabled={readOnly}
              value={values.mobile}
              onChange={(event) => setField("mobile", event.target.value)}
            />
          )}
        </Field>
      </div>

      <h3>Address</h3>
      <div className="grid-2">
        <Field label="Street" error={errors.address_street}>
          {(props) => (
            <input
              {...props}
              className="input"
              disabled={readOnly}
              value={values.address_street}
              onChange={(event) => setField("address_street", event.target.value)}
            />
          )}
        </Field>
        <Field label="City" error={errors.address_city}>
          {(props) => (
            <input
              {...props}
              className="input"
              disabled={readOnly}
              value={values.address_city}
              onChange={(event) => setField("address_city", event.target.value)}
            />
          )}
        </Field>
        <Field label="State" error={errors.address_state}>
          {(props) => (
            <input
              {...props}
              className="input"
              disabled={readOnly}
              value={values.address_state}
              onChange={(event) => setField("address_state", event.target.value)}
            />
          )}
        </Field>
        <Field label="Country" error={errors.address_country}>
          {(props) => (
            <input
              {...props}
              className="input"
              disabled={readOnly}
              value={values.address_country}
              onChange={(event) => setField("address_country", event.target.value)}
            />
          )}
        </Field>
        <Field label="Pincode" error={errors.address_pincode}>
          {(props) => (
            <input
              {...props}
              className="input"
              disabled={readOnly}
              value={values.address_pincode}
              onChange={(event) => setField("address_pincode", event.target.value)}
            />
          )}
        </Field>
      </div>

      <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
        Account mapping
        <InfoTooltip text="Where documents for this contact post in the ledger. Leave both blank to use the system default (Debtors / Creditors) — only override this if this contact needs its own sub-ledger account." />
      </h3>
      <div className="grid-2">
        <Field label="Receivable account" hint="Used when this contact is invoiced">
          {(props) => (
            <select
              {...props}
              className="select"
              disabled={readOnly}
              value={values.receivable_account_id}
              onChange={(event) => setField("receivable_account_id", event.target.value)}
            >
              <option value="">System default (Debtors)</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>{accountLabel(account)}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Payable account" hint="Used when this contact bills you">
          {(props) => (
            <select
              {...props}
              className="select"
              disabled={readOnly}
              value={values.payable_account_id}
              onChange={(event) => setField("payable_account_id", event.target.value)}
            >
              <option value="">System default (Creditors)</option>
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
