"use client";

/**
 * Register-a-payment modal shared by the invoice, bill and portal "Pay" flows
 * (04_API_CONTRACT.md §3.4). Partner and amount are pre-filled from the source
 * document; the server re-derives both and ignores anything inconsistent — the
 * `Idempotency-Key` header is what makes a double-click safe.
 */

import { useState } from "react";

import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { api, type Journal, type Payment, type PaymentDirection } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { fieldErrorsFrom, formMessageFrom, paymentSchema, validate, type FieldErrors } from "@/lib/validation";

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoiceId?: string;
  billId?: string;
  direction: PaymentDirection;
  remainingBalance: number;
  onSuccess: (payment: Payment) => void;
  usePortal?: boolean;
}

function journalLabel(journal: Journal): string {
  return `${journal.name} (${journal.type})`;
}

export function PaymentModal({
  open, onClose, invoiceId, billId, direction, remainingBalance, onSuccess, usePortal,
}: PaymentModalProps) {
  const journals = useFetch(() => api.journals.list({ page_size: 100 }), []);
  const bankOrCash = (journals.data?.items ?? []).filter((j) => j.type === "BANK" || j.type === "CASH");

  const [journalId, setJournalId] = useState("");
  const [amount, setAmount] = useState(String(remainingBalance));
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // Reset the form each time the modal opens — the "adjust state during
  // render" pattern (react.dev/learn/you-might-not-need-an-effect), not an
  // effect, so it can't cascade an extra render.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAmount(String(remainingBalance));
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setNote("");
      setErrors({});
      setFormError(null);
      setIdempotencyKey(crypto.randomUUID());
    }
  }

  // Default to the first Bank/Cash journal once the list loads, without
  // overriding a choice the user already made.
  const effectiveJournalId = journalId || bankOrCash[0]?.id || "";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const result = validate(paymentSchema, { journal_id: effectiveJournalId, amount, payment_date: paymentDate, note });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const body = {
        invoice_id: invoiceId,
        bill_id: billId,
        direction,
        journal_id: result.data.journal_id,
        amount: result.data.amount,
        payment_date: result.data.payment_date,
        note: result.data.note || undefined,
      };
      const payment = usePortal
        ? await api.portal.pay(body, idempotencyKey)
        : await api.payments.create(body, idempotencyKey);
      onSuccess(payment);
      onClose();
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      setFormError(formMessageFrom(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={direction === "RECEIVE" ? "Register receipt" : "Register payment"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" form="payment-modal-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Confirm"}
          </button>
        </>
      }
    >
      <form id="payment-modal-form" className="stack" onSubmit={handleSubmit} noValidate>
        {formError ? <div className="alert alert-danger" role="alert">{formError}</div> : null}

        <Field label="Journal" error={errors.journal_id} required>
          {(props) => (
            <select {...props} className="select" value={effectiveJournalId} onChange={(event) => setJournalId(event.target.value)}>
              <option value="">Select a journal…</option>
              {bankOrCash.map((journal) => (
                <option key={journal.id} value={journal.id}>{journalLabel(journal)}</option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Amount" error={errors.amount} hint={`Remaining balance: ${remainingBalance.toFixed(2)}`} required>
          {(props) => (
            <input {...props} className="input tabular" type="number" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          )}
        </Field>

        <Field label="Payment date" error={errors.payment_date} required>
          {(props) => (
            <input {...props} className="input" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
          )}
        </Field>

        <Field label="Note" error={errors.note}>
          {(props) => (
            <input {...props} className="input" placeholder="e.g. UPI ref 4471" value={note} onChange={(event) => setNote(event.target.value)} />
          )}
        </Field>
      </form>
    </Modal>
  );
}
