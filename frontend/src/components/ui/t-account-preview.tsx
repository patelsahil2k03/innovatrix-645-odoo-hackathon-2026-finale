"use client";

/**
 * The posting preview — a classic T-account, debits left, credits right,
 * shown before Confirm (05_FRONTEND.md §7.1). Purely presentational: every
 * number is computed by lib/use-document-lines.ts, this only renders rows.
 * Nothing here is required by the spec — it's marked as ours in the docs, and
 * it stays that way here too.
 */

import { money } from "@/lib/format";
import type { PostingPreview } from "@/lib/use-document-lines";

export function TAccountPreview({ debitRows, creditRows, totalDebit, totalCredit, balanced }: PostingPreview) {
  return (
    <div className="stack">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <span className="card-title">Journal entry that will be created</span>
      </div>

      <div className="t-account">
        <div className="t-account-col">
          <div className="t-account-head">Debit</div>
          {debitRows.map((row) => (
            <div className="t-account-row" key={row.label}>
              <span>{row.label}</span>
              <span className="num">{money(row.amount)}</span>
            </div>
          ))}
          <div className="t-account-total">
            <span>Total</span>
            <span className="num">{money(totalDebit)}</span>
          </div>
        </div>
        <div className="t-account-col">
          <div className="t-account-head">Credit</div>
          {creditRows.map((row) => (
            <div className="t-account-row" key={row.label}>
              <span>{row.label}</span>
              <span className="num">{money(row.amount)}</span>
            </div>
          ))}
          <div className="t-account-total">
            <span>Total</span>
            <span className="num">{money(totalCredit)}</span>
          </div>
        </div>
      </div>

      {!balanced ? (
        <div className="alert alert-danger" role="alert">
          Debits and credits differ by {money(Math.abs(totalDebit - totalCredit))} — Confirm is disabled
          until this document balances.
        </div>
      ) : null}
    </div>
  );
}
