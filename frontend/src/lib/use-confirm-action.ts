"use client";

import { useCallback, useState } from "react";

import { formMessageFrom } from "@/lib/validation";

interface ConfirmActionState {
  /** Whether the confirm dialog should be open. */
  open: boolean;
  /** Whether the guarded action is in flight. */
  pending: boolean;
  error: string | null;
  /** Call from the triggering button — opens the dialog, does not run the action. */
  request: () => void;
  /** Call from the dialog's cancel/close — no-op while pending. */
  cancel: () => void;
  /** Call from the dialog's confirm button — runs the action, closes on success. */
  confirm: () => void;
}

/**
 * Owns the open/pending/error state for a confirm-then-mutate flow (archive,
 * cancel a posted document, discard a draft) so pages only render a
 * `ConfirmDialog` and never fire the mutation straight from a button's
 * onClick. Keeps that state machine out of the .tsx file per `RULES.md` §8.
 */
export function useConfirmAction(action: () => Promise<void>): ConfirmActionState {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  const cancel = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  const confirm = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      await action();
      setOpen(false);
    } catch (err) {
      setError(formMessageFrom(err));
    } finally {
      setPending(false);
    }
  }, [action]);

  return { open, pending, error, request, cancel, confirm };
}
