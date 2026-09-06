"use client";

/**
 * The close control on every panel — the `/new` forms and the `{id}` detail
 * screens. One component, used everywhere (RULES.md §8): a page never hand-rolls
 * a second one, so "close" looks and behaves identically on all of them.
 *
 * It renders inside `.page-head`, whose first child takes `margin-right: auto`,
 * so this sits at the far right next to whatever actions a panel already has
 * (Archive, Post, Pay) without disturbing them.
 *
 * The decision of *where* closing goes is `useClosePanel`, not this file.
 */

import { CloseIcon } from "@/components/icons";
import { useClosePanel } from "@/lib/use-close-panel";

interface ClosePanelProps {
  /**
   * Where to land when the panel was opened directly rather than navigated to
   * (a pasted link, a new tab). Defaults to one path segment up, which is the
   * list for every panel except the budget-line drill-down.
   */
  fallbackHref?: string;
  /** Names the destination for screen readers, e.g. "Close and return to invoices". */
  label?: string;
}

export function ClosePanel({ fallbackHref, label = "Close" }: ClosePanelProps) {
  const { close } = useClosePanel({ fallbackHref });

  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={close}
      aria-label={label}
      title={`${label} (Esc)`}
    >
      <CloseIcon />
    </button>
  );
}
