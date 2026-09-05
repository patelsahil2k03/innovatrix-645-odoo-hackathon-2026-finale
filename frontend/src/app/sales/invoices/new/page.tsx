"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Field } from "@/components/ui/field";
import { LineItemsEditor } from "@/components/ui/line-items-editor";
import { TAccountPreview } from "@/components/ui/t-account-preview";
import { api, type Account, type Product } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { buildSalesPostingPreview, lineDefaultsFromProduct, useDocumentLines } from "@/lib/use-document-lines";
import { documentLinesSchema, fieldErrorsFrom, formMessageFrom, required, validate } from "@/lib/validation";

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export default function NewCustomerInvoicePage() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const contacts = useFetch(() => api.contacts.list({ page_size: 200, sort: "name" }), []);
  const products = useFetch(() => api.products.list({ page_size: 200, sort: "name" }), []);
  const accounts = useFetch(() => api.accounts.list({ page_size: 200 }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 200, sort: "name" }), []);
  const customers = (contacts.data?.items ?? []).filter((c) => c.type === "CUSTOMER" || c.type === "BOTH");

  const { lines, addLine, removeLine, updateLine, selectProduct, totals } = useDocumentLines();

  const productsById = useMemo(() => byId<Product>(products.data?.items ?? []), [products.data]);
  const accountsById = useMemo(() => byId<Account>(accounts.data?.items ?? []), [accounts.data]);
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const receivableAccount = selectedCustomer?.receivable_account_id
    ? accountsById[selectedCustomer.receivable_account_id]
    : undefined;
  const receivableLabel = receivableAccount
    ? `${receivableAccount.code} ${receivableAccount.name}`
    : "1100 Debtors";

  const preview = buildSalesPostingPreview(lines, receivableLabel, productsById, accountsById);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const customerResult = validate(required("Customer"), customerId);
    const linesResult = validate(documentLinesSchema, lines);
    if (!customerResult.ok) {
      setCustomerError("Customer is required");
      return;
    }
    setCustomerError(null);
    if (!linesResult.ok) {
      setFormError("Fix the highlighted lines before saving.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.customerInvoices.create({
        reference: reference || null,
        customer_id: customerId,
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        lines: linesResult.data,
      });
      router.push(`/sales/invoices/${created.id}`);
    } catch (error) {
      setFormError(formMessageFrom(error));
      const fields = fieldErrorsFrom(error);
      if (fields.customer_id) setCustomerError(fields.customer_id);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>New sale invoice</h1>
          <p>Saved as a draft — nothing posts to the ledger until you confirm it.</p>
        </div>
      </div>

      <form className="stack" onSubmit={handleSubmit} noValidate>
        {formError ? <div className="alert alert-danger" role="alert">{formError}</div> : null}

        <div className="card grid-2">
          <Field label="Customer" error={customerError ?? undefined} required>
            {(props) => (
              <select {...props} className="select" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">Select a customer…</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Invoice date" required>
            {(props) => (
              <input {...props} className="input" type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
            )}
          </Field>
          <Field label="Due date">
            {(props) => (
              <input {...props} className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            )}
          </Field>
          <Field label="Reference" hint="The customer's own PO number, if any">
            {(props) => (
              <input {...props} className="input" value={reference} onChange={(event) => setReference(event.target.value)} />
            )}
          </Field>
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">Invoice lines</span></div>
          <LineItemsEditor
            lines={lines}
            products={products.data?.items ?? []}
            analyticAccounts={analyticAccounts.data?.items ?? []}
            onAdd={addLine}
            onRemove={removeLine}
            onUpdate={updateLine}
            onSelectProduct={(key, productId) => {
              const product = products.data?.items.find((p) => p.id === productId);
              selectProduct(key, productId, product ? lineDefaultsFromProduct(product, "sales") : {});
            }}
            totals={totals}
          />
        </div>

        <div className="card">
          <TAccountPreview {...preview} />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ alignSelf: "flex-start" }}>
          {submitting ? "Saving…" : "Save invoice"}
        </button>
      </form>
    </AppShell>
  );
}
