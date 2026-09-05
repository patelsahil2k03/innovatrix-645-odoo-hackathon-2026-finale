"use client";

/**
 * Owns the editable line array for every order/bill/invoice form, plus every
 * derived number — RULES.md §8: a .tsx file may render and dispatch, never
 * decide. Quantity/price/tax changes recompute the DISPLAY total here; the
 * authoritative total always comes back from the server on save
 * (05_FRONTEND.md §7).
 */

import { useCallback, useMemo, useState } from "react";

import type { Account, AnalyticType, DocumentLine, Product } from "@/lib/api";

export interface DraftLine extends DocumentLine {
  /** Stable client-side identity for React keys and edits — never sent to the API. */
  key: string;
}

let seq = 0;
const nextKey = (): string => `line-${++seq}`;

export function emptyLine(): DraftLine {
  return {
    key: nextKey(),
    product_id: "",
    analytic_account_id: null,
    quantity: 1,
    unit_price: 0,
    tax_pct: 0,
  };
}

/** Round half-up to paisa. Never let JS float drift show up as ₹999.9999999. */
export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export interface LineAmounts {
  untaxed: number;
  tax: number;
  grand: number;
}

export function lineAmounts(line: DocumentLine): LineAmounts {
  const untaxed = round2((line.quantity || 0) * (line.unit_price || 0));
  const tax = round2((untaxed * (line.tax_pct || 0)) / 100);
  return { untaxed, tax, grand: round2(untaxed + tax) };
}

/** A product defaults a line's price/tax/account at the moment it's picked —
 *  a snapshot, editable from then on, never re-read from the product later
 *  (03_DATA_MODEL.md §6). `side` picks sales price + income account vs. cost
 *  price + expense account. */
export function lineDefaultsFromProduct(
  product: Product,
  side: "sales" | "purchase",
): Partial<DocumentLine> {
  return side === "sales"
    ? {
        unit_price: product.sales_price,
        tax_pct: product.sales_tax_pct,
        account_id: product.income_account_id ?? undefined,
      }
    : {
        unit_price: product.cost_price,
        tax_pct: product.sales_tax_pct,
        account_id: product.expense_account_id ?? undefined,
      };
}

export function useDocumentLines(initial: DocumentLine[] = []) {
  const [lines, setLines] = useState<DraftLine[]>(
    initial.length ? initial.map((line) => ({ ...line, key: nextKey() })) : [emptyLine()],
  );

  const addLine = useCallback(() => setLines((prev) => [...prev, emptyLine()]), []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
  }, []);

  const updateLine = useCallback((key: string, patch: Partial<DocumentLine>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }, []);

  const selectProduct = useCallback(
    (key: string, productId: string, defaults: Partial<DocumentLine>) => {
      setLines((prev) =>
        prev.map((line) => (line.key === key ? { ...line, product_id: productId, ...defaults } : line)),
      );
    },
    [],
  );

  const totals = useMemo(() => {
    let untaxed = 0;
    let tax = 0;
    for (const line of lines) {
      const amounts = lineAmounts(line);
      untaxed += amounts.untaxed;
      tax += amounts.tax;
    }
    return { untaxed_total: round2(untaxed), tax_total: round2(tax), total: round2(untaxed + tax) };
  }, [lines]);

  return { lines, addLine, removeLine, updateLine, selectProduct, totals };
}

/* ── The posting preview T-account (05_FRONTEND.md §7.1) ─────────────────────
   Ours, not a spec item — computed here so the .tsx form only renders rows. */

export interface TAccountRow {
  label: string;
  amount: number;
}
export interface PostingPreview {
  debitRows: TAccountRow[];
  creditRows: TAccountRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

function groupByAccount(
  lines: DocumentLine[],
  productsById: Record<string, Product>,
  accountsById: Record<string, Account>,
  side: "sales" | "purchase",
  fallbackLabel: string,
): TAccountRow[] {
  const groups = new Map<string, number>();
  for (const line of lines) {
    if (!line.product_id) continue;
    const product = productsById[line.product_id];
    const accountId = side === "sales" ? product?.income_account_id : product?.expense_account_id;
    const account = accountId ? accountsById[accountId] : undefined;
    const label = account ? `${account.code} ${account.name}` : fallbackLabel;
    const untaxed = round2((line.quantity || 0) * (line.unit_price || 0));
    groups.set(label, round2((groups.get(label) ?? 0) + untaxed));
  }
  return [...groups.entries()].map(([label, amount]) => ({ label, amount }));
}

/** Customer invoice: Dr Debtors (total) / Cr each product's income account
 *  (untaxed) / Cr Output Tax (03_DATA_MODEL.md §5). */
export function buildSalesPostingPreview(
  lines: DocumentLine[],
  receivableLabel: string,
  productsById: Record<string, Product>,
  accountsById: Record<string, Account>,
): PostingPreview {
  const creditRows = groupByAccount(lines, productsById, accountsById, "sales", "4000 Sales Income");
  const tax = round2(
    lines.reduce((sum, line) => sum + lineAmounts(line).tax, 0),
  );
  if (tax > 0) creditRows.push({ label: "2100 Output Tax", amount: tax });
  const totalCredit = round2(creditRows.reduce((sum, row) => sum + row.amount, 0));
  return {
    debitRows: [{ label: receivableLabel, amount: totalCredit }],
    creditRows,
    totalDebit: totalCredit,
    totalCredit,
    balanced: true,
  };
}

/** Vendor bill: Dr each product's expense account (untaxed) / Dr Input Tax /
 *  Cr Creditors (total) — the mirror image of the sales posting. */
export function buildPurchasePostingPreview(
  lines: DocumentLine[],
  payableLabel: string,
  productsById: Record<string, Product>,
  accountsById: Record<string, Account>,
): PostingPreview {
  const debitRows = groupByAccount(lines, productsById, accountsById, "purchase", "5000 Purchase Expense");
  const tax = round2(
    lines.reduce((sum, line) => sum + lineAmounts(line).tax, 0),
  );
  if (tax > 0) debitRows.push({ label: "1200 Input Tax", amount: tax });
  const totalDebit = round2(debitRows.reduce((sum, row) => sum + row.amount, 0));
  return {
    debitRows,
    creditRows: [{ label: payableLabel, amount: totalDebit }],
    totalDebit,
    totalCredit: totalDebit,
    balanced: true,
  };
}

export type { AnalyticType };
