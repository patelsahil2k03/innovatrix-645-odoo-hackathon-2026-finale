"use client";

/**
 * Accessible right-side drawer — for actions that benefit from keeping the
 * underlying page visible (filters, a quick create/edit form, a preview)
 * rather than a full-page navigation or a centered `Modal`.
 *
 * Same accessibility contract as `Modal` — focus trap, Escape-to-close,
 * role="dialog", initial focus, focus restoration, body-scroll lock — just
 * anchored to the right edge instead of centered, with the close control as
 * a floating circle on the edge instead of a header button. Pair with
 * `useDrawer` (`lib/use-drawer.ts`) for the open/close state.
 *
 * Use this everywhere a side panel is needed. Do not hand-roll a second one.
 */

import { useCallback, useEffect, useId, useRef } from "react";

import { CloseIcon } from "@/components/icons";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Percentage of viewport width the drawer covers on desktop. Every
   *  drawer in the app uses 60 — a single fixed width, not a per-form
   *  choice. Clamped to 30-80. Always full-width below the 640px breakpoint. */
  width?: number;
}

export function Drawer({ open, title, onClose, children, footer, width = 60 }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const closeTipId = useId();
  const widthPct = Math.min(80, Math.max(30, width));

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      // Wrap focus at both ends so Tab can never escape the drawer.
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first control so keyboard users start inside the drawer.
    const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    firstFocusable?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={drawerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ "--drawer-w": `${widthPct}vw` } as React.CSSProperties}
      >
        <button
          type="button"
          className="drawer-close"
          onClick={onClose}
          aria-label="Close"
          aria-describedby={closeTipId}
        >
          <svg className="drawer-close-ring" viewBox="0 0 38 38" aria-hidden="true">
            <rect x="1" y="1" width="36" height="36" rx="17" pathLength={1} />
          </svg>
          <CloseIcon size={16} />
        </button>
        <span role="tooltip" id={closeTipId} className="drawer-close-tip">
          Close <kbd>Esc</kbd>
        </span>
        <div className="drawer-head">
          <h3 id={titleId} className="card-title">{title}</h3>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
