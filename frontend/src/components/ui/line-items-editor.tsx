"use client";

/**
 * The document line editor shared by every order/bill/invoice form
 * (05_FRONTEND.md §7: "the hardest form in this app"). Adding a line must not
 * lose focus or reset the row above it — each row is keyed by a stable
 * client-side id from lib/use-document-lines.ts, never by array index.
 *
 * Purely presentational: every number comes from lib/use-document-lines.ts.
 * This component renders rows and calls back; it never computes a total.
 *
 * Each row is its own memoized component: `updateLine`/`selectProduct` in
 * use-document-lines.ts only replace the *edited* line's object in the array,
 * so every other row keeps the same reference — React.memo lets those rows
 * skip re-rendering entirely when one line changes.
 */

import { memo, useCallback, useMemo, type ChangeEvent } from "react";

import { PlusIcon, TrashIcon } from "@/components/icons";
import { money } from "@/lib/format";
import { lineAmounts, type DraftLine } from "@/lib/use-document-lines";
import type { AnalyticAccount, DocumentLine, Product } from "@/lib/api";

export interface LineFieldErrors {
  product_id?: string;
  quantity?: string;
  unit_price?: string;
  tax_pct?: string;
}

interface LineItemsEditorProps {
  lines: DraftLine[];
  products: Product[];
  analyticAccounts: AnalyticAccount[];
  errors?: Record<string, LineFieldErrors>;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onUpdate: (key: string, patch: Partial<DocumentLine>) => void;
  onSelectProduct: (key: string, productId: string) => void;
  totals: { untaxed_total: number; tax_total: number; total: number };
  readOnly?: boolean;
}

interface LineItemRowProps {
  line: DraftLine;
  product: Product | undefined;
  analyticAccountName: string | undefined;
  products: Product[];
  analyticAccounts: AnalyticAccount[];
  error?: LineFieldErrors;
  onRemove: (key: string) => void;
  onUpdate: (key: string, patch: Partial<DocumentLine>) => void;
  onSelectProduct: (key: string, productId: string) => void;
  removeDisabled: boolean;
  readOnly?: boolean;
}

const LineItemRow = memo(function LineItemRow({
  line, product, analyticAccountName, products, analyticAccounts, error,
  onRemove, onUpdate, onSelectProduct, removeDisabled, readOnly,
}: LineItemRowProps) {
  const amounts = lineAmounts(line);

  const handleSelectProduct = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => onSelectProduct(line.key, event.target.value),
    [line.key, onSelectProduct],
  );
  const handleAnalyticChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      onUpdate(line.key, { analytic_account_id: event.target.value || null }),
    [line.key, onUpdate],
  );
  const handleQuantityChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onUpdate(line.key, { quantity: Number(event.target.value) }),
    [line.key, onUpdate],
  );
  const handleUnitPriceChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onUpdate(line.key, { unit_price: Number(event.target.value) }),
    [line.key, onUpdate],
  );
  const handleTaxPctChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onUpdate(line.key, { tax_pct: Number(event.target.value) }),
    [line.key, onUpdate],
  );
  const handleRemove = useCallback(() => onRemove(line.key), [line.key, onRemove]);

  return (
    <tr>
      <td>
        {readOnly ? (
          product?.name ?? line.product_name ?? "—"
        ) : (
          <>
            <select
              className="select"
              aria-label="Product"
              aria-invalid={Boolean(error?.product_id)}
              value={line.product_id}
              onChange={handleSelectProduct}
            >
              <option value="">Select a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {error?.product_id ? (
              <span className="field-error" role="alert">{error.product_id}</span>
            ) : null}
          </>
        )}
      </td>
      <td>
        {readOnly ? (
          analyticAccountName ?? "—"
        ) : (
          <select
            className="select"
            aria-label="Analytical account"
            value={line.analytic_account_id ?? ""}
            onChange={handleAnalyticChange}
          >
            <option value="">—</option>
            {analyticAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
      </td>
      <td className="num">
        {readOnly ? line.quantity : (
          <input
            className="input tabular"
            style={{ textAlign: "right" }}
            type="number"
            min={0}
            step="0.01"
            aria-label="Quantity"
            aria-invalid={Boolean(error?.quantity)}
            value={line.quantity}
            onChange={handleQuantityChange}
          />
        )}
      </td>
      <td className="num">
        {readOnly ? money(line.unit_price) : (
          <input
            className="input tabular"
            style={{ textAlign: "right" }}
            type="number"
            min={0}
            step="0.01"
            aria-label="Unit price"
            aria-invalid={Boolean(error?.unit_price)}
            value={line.unit_price}
            onChange={handleUnitPriceChange}
          />
        )}
      </td>
      <td className="num">
        {readOnly ? `${line.tax_pct}%` : (
          <input
            className="input tabular"
            style={{ textAlign: "right" }}
            type="number"
            min={0}
            max={100}
            step="0.01"
            aria-label="Tax percent"
            aria-invalid={Boolean(error?.tax_pct)}
            value={line.tax_pct}
            onChange={handleTaxPctChange}
          />
        )}
      </td>
      <td className="num">{money(amounts.untaxed)}</td>
      {readOnly ? null : (
        <td>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleRemove}
            disabled={removeDisabled}
            aria-label="Remove line"
          >
            <TrashIcon size={14} />
          </button>
        </td>
      )}
    </tr>
  );
});

export const LineItemsEditor = memo(function LineItemsEditor({
  lines, products, analyticAccounts, errors, onAdd, onRemove, onUpdate, onSelectProduct, totals, readOnly,
}: LineItemsEditorProps) {
  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const analyticNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of analyticAccounts) map.set(a.id, a.name);
    return map;
  }, [analyticAccounts]);

  const removeDisabled = lines.length <= 1;

  return (
    <div className="stack">
      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Product</th>
                <th style={{ minWidth: 160 }}>Analytical</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Unit price</th>
                <th style={{ textAlign: "right" }}>Tax %</th>
                <th style={{ textAlign: "right" }}>Line total</th>
                {readOnly ? null : <th aria-label="Remove line" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <LineItemRow
                  key={line.key}
                  line={line}
                  product={productsById.get(line.product_id)}
                  analyticAccountName={
                    line.analytic_account_id ? analyticNameById.get(line.analytic_account_id) : undefined
                  }
                  products={products}
                  analyticAccounts={analyticAccounts}
                  error={errors?.[line.key]}
                  onRemove={onRemove}
                  onUpdate={onUpdate}
                  onSelectProduct={onSelectProduct}
                  removeDisabled={removeDisabled}
                  readOnly={readOnly}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {readOnly ? null : (
        <button type="button" className="btn btn-sm" onClick={onAdd} style={{ alignSelf: "flex-start" }}>
          <PlusIcon size={14} />
          Add a line
        </button>
      )}

      <div className="row-between" style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--s-3)" }}>
        <span />
        <div className="stack" style={{ gap: 4, minWidth: 220 }}>
          <div className="row-between"><span style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>Untaxed total</span><span className="num">{money(totals.untaxed_total)}</span></div>
          <div className="row-between"><span style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>Tax</span><span className="num">{money(totals.tax_total)}</span></div>
          <div className="row-between" style={{ fontWeight: 700 }}><span>Total</span><span className="num">{money(totals.total)}</span></div>
        </div>
      </div>
    </div>
  );
});
