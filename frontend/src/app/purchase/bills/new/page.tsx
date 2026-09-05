"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Field } from "@/components/ui/field";
import { LineItemsEditor } from "@/components/ui/line-items-editor";
import { TAccountPreview } from "@/components/ui/t-account-preview";
import { api, type Account, type Product } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { buildPurchasePostingPreview, lineDefaultsFromProduct, useDocumentLines } from "@/lib/use-document-lines";
import { documentLinesSchema, fieldErrorsFrom, formMessageFrom, required, validate } from "@/lib/validation";

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export default function NewVendorBillPage() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const contacts = useFetch(() => api.contacts.list({ page_size: 200, sort: "name" }), []);
  const products = useFetch(() => api.products.list({ page_size: 200, sort: "name" }), []);
  const accounts = useFetch(() => api.accounts.list({ page_size: 200 }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 200, sort: "name" }), []);
  const vendors = (contacts.data?.items ?? []).filter((c) => c.type === "VENDOR" || c.type === "BOTH");

  const { lines, addLine, removeLine, updateLine, selectProduct, totals } = useDocumentLines();

  const productsById = useMemo(() => byId<Product>(products.data?.items ?? []), [products.data]);
  const accountsById = useMemo(() => byId<Account>(accounts.data?.items ?? []), [accounts.data]);
  const selectedVendor = vendors.find((v) => v.id === vendorId);
  const payableAccount = selectedVendor?.payable_account_id ? accountsById[selectedVendor.payable_account_id] : undefined;
  const payableLabel = payableAccount ? `${payableAccount.code} ${payableAccount.name}` : "2000 Creditors";

  const preview = buildPurchasePostingPreview(lines, payableLabel, productsById, accountsById);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const vendorResult = validate(required("Vendor"), vendorId);
    const linesResult = validate(documentLinesSchema, lines);
    if (!vendorResult.ok) {
      setVendorError("Vendor is required");
      return;
    }
    setVendorError(null);
    if (!linesResult.ok) {
      setFormError("Fix the highlighted lines before saving.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.vendorBills.create({
        reference: reference || null,
        vendor_id: vendorId,
        bill_date: billDate,
        due_date: dueDate || null,
        lines: linesResult.data,
      });
      router.push(`/purchase/bills/${created.id}`);
    } catch (error) {
      setFormError(formMessageFrom(error));
      const fields = fieldErrorsFrom(error);
      if (fields.vendor_id) setVendorError(fields.vendor_id);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>New vendor bill</h1>
          <p>Saved as a draft — a bill can be raised fresh or from a purchase order.</p>
        </div>
      </div>

      <form className="stack" onSubmit={handleSubmit} noValidate>
        {formError ? <div className="alert alert-danger" role="alert">{formError}</div> : null}

        <div className="card grid-2">
          <Field label="Vendor" error={vendorError ?? undefined} required>
            {(props) => (
              <select {...props} className="select" value={vendorId} onChange={(event) => setVendorId(event.target.value)}>
                <option value="">Select a vendor…</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Bill date" required>
            {(props) => (
              <input {...props} className="input" type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} />
            )}
          </Field>
          <Field label="Due date">
            {(props) => (
              <input {...props} className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            )}
          </Field>
          <Field label="Reference" hint="The vendor's own bill number, if any">
            {(props) => (
              <input {...props} className="input" value={reference} onChange={(event) => setReference(event.target.value)} />
            )}
          </Field>
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">Bill lines</span></div>
          <LineItemsEditor
            lines={lines}
            products={products.data?.items ?? []}
            analyticAccounts={analyticAccounts.data?.items ?? []}
            onAdd={addLine}
            onRemove={removeLine}
            onUpdate={updateLine}
            onSelectProduct={(key, productId) => {
              const product = products.data?.items.find((p) => p.id === productId);
              selectProduct(key, productId, product ? lineDefaultsFromProduct(product, "purchase") : {});
            }}
            totals={totals}
          />
        </div>

        <div className="card">
          <TAccountPreview {...preview} />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ alignSelf: "flex-start" }}>
          {submitting ? "Saving…" : "Save bill"}
        </button>
      </form>
    </AppShell>
  );
}
