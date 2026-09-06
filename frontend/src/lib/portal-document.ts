/**
 * What a portal document *is* and what a customer may do with it.
 *
 * "Is this payable" and "how much is still owed" are rules, not rendering, so
 * they live here rather than inside the page (brain/RULES.md §8). The server
 * enforces both regardless — a payment against a draft or a settled document
 * is refused by `services/payments.py` whatever the button says.
 */

import type { CustomerInvoice, VendorBill } from "@/lib/api";
import { round2 } from "@/lib/use-document-lines";

export type PortalDocument = CustomerInvoice | VendorBill;

/** Discriminated on `customer_id`, the field only an invoice carries — the
 *  same test the page used before this moved out of it. */
export function isInvoice(doc: PortalDocument): doc is CustomerInvoice {
  return "customer_id" in doc;
}

export interface PortalDocumentView {
  isInvoice: boolean;
  /** The document's own date, whichever kind it is. */
  date: string;
  /** Still owed, rounded the same way money is everywhere else. */
  remaining: number;
  /** Only a posted or part-paid document can take a payment: a draft has not
   *  been issued yet, and a paid or cancelled one has nothing left to settle. */
  canPay: boolean;
}

export function portalDocumentView(doc: PortalDocument): PortalDocumentView {
  const invoice = isInvoice(doc);
  return {
    isInvoice: invoice,
    date: invoice ? doc.invoice_date : doc.bill_date,
    remaining: round2(doc.total - doc.amount_paid),
    canPay: doc.status === "POSTED" || doc.status === "PARTIAL",
  };
}
