"use client";

/**
 * Create/edit form shared by /account/products/new and /account/products/[id].
 * Category is creatable inline (03_DATA_MODEL.md §2); income/expense accounts
 * are what a sale/purchase of this product posts against.
 */

import { useState } from "react";

import { CategoryCombobox } from "@/components/ui/category-combobox";
import { Field } from "@/components/ui/field";
import { api, type Account, type Product, type ProductCreate } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { fieldErrorsFrom, formMessageFrom, productSchema, validate, type FieldErrors } from "@/lib/validation";

export interface ProductFormValues {
  name: string;
  type: Product["type"];
  sales_price: string;
  cost_price: string;
  category_id: string;
  sales_tax_pct: string;
  income_account_id: string;
  expense_account_id: string;
}

const BLANK: ProductFormValues = {
  name: "",
  type: "GOODS",
  sales_price: "0",
  cost_price: "0",
  category_id: "",
  sales_tax_pct: "18",
  income_account_id: "",
  expense_account_id: "",
};

export function productToFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    type: product.type,
    sales_price: String(product.sales_price),
    cost_price: String(product.cost_price),
    category_id: product.category_id ?? "",
    sales_tax_pct: String(product.sales_tax_pct),
    income_account_id: product.income_account_id ?? "",
    expense_account_id: product.expense_account_id ?? "",
  };
}

interface ProductFormProps {
  initial?: ProductFormValues;
  onSubmit: (values: ProductCreate) => Promise<void>;
  submitLabel: string;
  readOnly?: boolean;
}

function accountLabel(account: Account): string {
  return `${account.code} — ${account.name}`;
}

export function ProductForm({ initial, onSubmit, submitLabel, readOnly }: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>(initial ?? BLANK);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const categories = useFetch(() => api.productCategories.list({ page_size: 200, sort: "name" }), []);
  const accounts = useFetch(() => api.accounts.list({ page_size: 200, sort: "code" }), []);
  const accountOptions = accounts.data?.items ?? [];

  function setField<K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreateCategory(name: string) {
    const created = await api.productCategories.createInline(name);
    categories.reload();
    return created;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const result = validate(productSchema, values);
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
        sales_price: result.data.sales_price,
        cost_price: result.data.cost_price,
        category_id: result.data.category_id,
        sales_tax_pct: result.data.sales_tax_pct,
        income_account_id: values.income_account_id || null,
        expense_account_id: values.expense_account_id || null,
      });
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
              onChange={(event) => setField("type", event.target.value as Product["type"])}
            >
              <option value="GOODS">Goods</option>
              <option value="SERVICE">Service</option>
              <option value="COMBO">Combo</option>
            </select>
          )}
        </Field>

        {readOnly ? (
          <Field label="Category" error={errors.category_id} required>
            {(props) => (
              <input {...props} className="input" disabled value={
                categories.data?.items.find((c) => c.id === values.category_id)?.name ?? "—"
              } />
            )}
          </Field>
        ) : (
          <CategoryCombobox
            categories={categories.data?.items ?? []}
            value={values.category_id}
            onChange={(id) => setField("category_id", id)}
            onCreate={handleCreateCategory}
            error={errors.category_id}
          />
        )}

        <Field label="Sales tax %" error={errors.sales_tax_pct} required>
          {(props) => (
            <input
              {...props}
              className="input tabular"
              type="number" min={0} max={100} step="0.01"
              disabled={readOnly}
              value={values.sales_tax_pct}
              onChange={(event) => setField("sales_tax_pct", event.target.value)}
            />
          )}
        </Field>

        <Field label="Sales price" error={errors.sales_price} required>
          {(props) => (
            <input
              {...props}
              className="input tabular"
              type="number" min={0} step="0.01"
              disabled={readOnly}
              value={values.sales_price}
              onChange={(event) => setField("sales_price", event.target.value)}
            />
          )}
        </Field>

        <Field label="Cost price" error={errors.cost_price} required>
          {(props) => (
            <input
              {...props}
              className="input tabular"
              type="number" min={0} step="0.01"
              disabled={readOnly}
              value={values.cost_price}
              onChange={(event) => setField("cost_price", event.target.value)}
            />
          )}
        </Field>
      </div>

      <h3>Account mapping</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginTop: -8 }}>
        Where a sale/purchase of this product posts — snapshotted onto the document
        line when it&apos;s picked, never re-read from here later (03_DATA_MODEL.md §6).
      </p>
      <div className="grid-2">
        <Field label="Income account" hint="Credited when this product is sold">
          {(props) => (
            <select
              {...props}
              className="select"
              disabled={readOnly}
              value={values.income_account_id}
              onChange={(event) => setField("income_account_id", event.target.value)}
            >
              <option value="">System default (Sales Income)</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>{accountLabel(account)}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Expense account" hint="Debited when this product is purchased">
          {(props) => (
            <select
              {...props}
              className="select"
              disabled={readOnly}
              value={values.expense_account_id}
              onChange={(event) => setField("expense_account_id", event.target.value)}
            >
              <option value="">System default (Purchase Expense)</option>
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
