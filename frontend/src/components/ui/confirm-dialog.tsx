"use client";

/**
 * Confirmation dialog for destructive or irreversible actions — archive,
 * cancel a posted document, discard a draft. Built on `Modal` so it inherits
 * the focus trap/Escape/restoration for free. Pair with `useConfirmAction`
 * (`lib/use-confirm-action.ts`), which owns the open/pending/error state.
 *
 * Never fire a destructive mutation straight from a button's onClick — route
 * it through this instead.
 */

import { AlertTriangleIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Go back",
  tone = "neutral",
  pending = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => { if (!pending) onCancel(); }}
      maxWidth={440}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? pendingLabel ?? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-dialog-body">
        <AlertTriangleIcon
          size={20}
          className={tone === "danger" ? "confirm-dialog-icon confirm-dialog-icon-danger" : "confirm-dialog-icon"}
        />
        <div className="stack" style={{ gap: "var(--s-2)" }}>{description}</div>
      </div>
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
    </Modal>
  );
}
