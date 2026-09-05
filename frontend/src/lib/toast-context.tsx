"use client";

/**
 * App-wide toast notifications — the only success/failure feedback surface
 * for actions that don't already have their own inline alert. One provider
 * wraps the app (see app/layout.tsx). Before this, no create/edit/save/
 * archive/cancel action anywhere in the app gave any confirmation it worked.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { ToastViewport } from "@/components/ui/toast";

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  push: (tone: ToastTone, message: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/** `useToast().success("Contact archived")` from anywhere in the app. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return {
    success: (message: string) => ctx.push("success", message),
    error: (message: string) => ctx.push("error", message),
    info: (message: string) => ctx.push("info", message),
  };
}
