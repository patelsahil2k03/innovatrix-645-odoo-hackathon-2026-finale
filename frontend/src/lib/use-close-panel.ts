"use client";

/**
 * Where "close" goes, decided outside the component.
 *
 * RULES.md §8: a `.tsx` file may read an already-computed value, render markup,
 * and call an action — it may not contain the branch that decides something. The
 * decision here is "does going back stay inside the app, or would it throw the
 * user out of it", which is exactly that kind of branch, so it lives here.
 */

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

/**
 * The list a panel belongs to: `/sales/orders/new` and `/sales/orders/{id}`
 * both close to `/sales/orders`.
 *
 * Exported and pure so it can be reasoned about (and tested) without a router.
 * Pages whose parent is not simply "one segment up" — the budget line drill-down,
 * for instance — pass `fallbackHref` explicitly instead of relying on this.
 */
export function parentRouteOf(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return "/";
  return `/${segments.slice(0, -1).join("/")}`;
}

/**
 * True when there is somewhere inside this app to go back to.
 *
 * The Next app router keeps an `idx` on `history.state` — 0 is the first entry
 * in this tab. Without this check, a panel opened from a pasted link or a new
 * tab would send the user to whatever preceded the app (or nowhere at all),
 * which is a worse outcome than simply landing on the list.
 *
 * `history.length` is deliberately not used: it counts entries from before the
 * app was ever opened, so it is almost always > 1 and proves nothing.
 */
function hasInAppHistory(): boolean {
  if (typeof window === "undefined") return false;
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" && idx > 0;
}

interface Options {
  /** Where to go when there is no in-app history. Defaults to one segment up. */
  fallbackHref?: string;
  /** Close on Escape, matching the modal's behaviour. Default true. */
  closeOnEscape?: boolean;
}

export function useClosePanel({ fallbackHref, closeOnEscape = true }: Options = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const target = fallbackHref ?? parentRouteOf(pathname ?? "/");

  const close = useCallback(() => {
    if (hasInAppHistory()) {
      router.back();
      return;
    }
    router.push(target);
  }, [router, target]);

  useEffect(() => {
    if (!closeOnEscape) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // A modal open on top of the panel owns Escape first; closing the panel
      // underneath it as well would dismiss two layers with one keypress.
      if (document.querySelector('[role="dialog"]')) return;
      // Escape inside a text field means "revert this edit" to most people, not
      // "discard the whole form".
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest("input, textarea, select")) {
        return;
      }
      close();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, closeOnEscape]);

  return { close, target };
}
