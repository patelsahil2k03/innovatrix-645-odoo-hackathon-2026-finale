"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Field } from "@/components/ui/field";
import { LineItemsEditor } from "@/components/ui/line-items-editor";
import { api } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { lineDefaultsFromProduct, useDocumentLines } from "@/lib/use-document-lines";
import { documentLinesSchema, fieldErrorsFrom, formMessageFrom, required, validate } from "@/lib/validation";

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const contacts = useFetch(() => api.contacts.list({ page_size: 200, sort: "name" }), []);
  const products = useFetch(() => api.products.list({ page_size: 200, sort: "name" }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 200, sort: "name" }), []);
  const customers = (contacts.data?.items ?? []).filter((c) => c.type === "CUSTOMER" || c.type === "BOTH");

  const { lines, addLine, removeLine, updateLine, selectProduct, totals } = useDocumentLines();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const customerResult = validate(required("Customer"), customerId);
    const linesResult = validate(documentLinesSchema, lines);
    if (!customerResult.ok) {
      setCustomerError(customerResult.errors.form ?? "Customer is required");
      return;
    }
    setCustomerError(null);
    if (!linesResult.ok) {
      setFormError("Fix the highlighted lines before saving.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.salesOrders.create({
        reference: reference || null,
        customer_id: customerId,
        order_date: orderDate,
        lines: linesResult.data,
      });
      router.push(`/sales/orders/${created.id}`);
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
          <h1>New sales order</h1>
          <p>Nothing posts to the ledger until this becomes an invoice and that invoice is posted.</p>
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
          <Field label="Order date" required>
            {(props) => (
              <input {...props} className="input" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
            )}
          </Field>
          <Field label="Reference" hint="The customer's own PO number, if any">
            {(props) => (
              <input {...props} className="input" value={reference} onChange={(event) => setReference(event.target.value)} />
            )}
          </Field>
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">Order lines</span></div>
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

        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ alignSelf: "flex-start" }}>
          {submitting ? "Saving…" : "Save sales order"}
        </button>
      </form>
    </AppShell>
  );
}
