"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { Field } from "@/components/ui/field";
import { LineItemsEditor } from "@/components/ui/line-items-editor";
import { ClosePanel } from "@/components/ui/close-panel";
import { api } from "@/lib/api";
import { parentRouteOf } from "@/lib/use-close-panel";
import { useFetch } from "@/lib/use-fetch";
import { useToast } from "@/lib/toast-context";
import { lineDefaultsFromProduct, useDocumentLines } from "@/lib/use-document-lines";
import { documentLinesSchema, fieldErrorsFrom, formMessageFrom, required, validate } from "@/lib/validation";

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [reference, setReference] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const contacts = useFetch(() => api.contacts.list({ page_size: 100, sort: "name" }), []);
  const products = useFetch(() => api.products.list({ page_size: 100, sort: "name" }), []);
  const analyticAccounts = useFetch(() => api.analyticAccounts.list({ page_size: 100, sort: "name" }), []);
  const vendors = (contacts.data?.items ?? []).filter((c) => c.type === "VENDOR" || c.type === "BOTH");

  const { lines, addLine, removeLine, updateLine, selectProduct, totals } = useDocumentLines();

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
      await api.purchaseOrders.create({
        reference: reference || null,
        vendor_id: vendorId,
        order_date: orderDate,
        lines: linesResult.data,
      });
      toast.success("Purchase order created");
      router.push(parentRouteOf(pathname ?? "/"));
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
          <h1>New purchase order</h1>
          <p>Nothing posts to the ledger until this becomes a bill and that bill is posted.</p>
        </div>
        <ClosePanel />
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
          <Field label="Order date" required>
            {(props) => (
              <input {...props} className="input" type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
            )}
          </Field>
          <Field label="Reference" hint="Your own reference for this order">
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
              selectProduct(key, productId, product ? lineDefaultsFromProduct(product, "purchase") : {});
            }}
            totals={totals}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ alignSelf: "flex-start" }}>
          {submitting ? "Saving…" : "Save purchase order"}
        </button>
      </form>
    </AppShell>
  );
}
