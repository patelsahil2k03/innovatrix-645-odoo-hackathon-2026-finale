"use client";

import { AlertTriangleIcon, CheckCircleIcon, CloseIcon } from "@/components/icons";
import type { ToastItem, ToastTone } from "@/lib/toast-context";

const ICON_BY_TONE: Record<ToastTone, typeof CheckCircleIcon | null> = {
  success: CheckCircleIcon,
  error: AlertTriangleIcon,
  info: null,
};

/**
 * Renders the live toast queue. Purely presentational — `ToastProvider`
 * (`lib/toast-context.tsx`) owns the queue and auto-dismiss timers.
 */
export function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICON_BY_TONE[toast.tone];
        return (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            {Icon ? <Icon size={16} /> : null}
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
