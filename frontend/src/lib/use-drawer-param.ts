"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Drives a list page's create/view/edit drawer from a URL query param
 * (default `open`) instead of local component state, so every drawer is a
 * real, reloadable, shareable URL (05_FRONTEND.md §6) — not only the report
 * drill-down targets, every drawer everywhere follows the same rule.
 *
 * `open=new` is the create drawer; any other value is a record id for the
 * view/edit drawer. The caller must be wrapped in `<Suspense>` — the same
 * requirement `useSearchParams` already carries elsewhere in this app
 * (see `account/journal-entries/page.tsx`).
 *
 *   const panel = useDrawerParam();
 *   <Link href={panel.hrefFor("new")}>New account</Link>
 *   <Link href={panel.hrefFor(row.id)}>{row.name}</Link>
 *   <Drawer open={panel.isNew || !!panel.openId} onClose={panel.close} …>
 */
export function useDrawerParam(paramName: string = "open") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(paramName);

  const hrefFor = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(paramName, id);
      return `${pathname}?${params.toString()}`;
    },
    [pathname, searchParams, paramName],
  );

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(paramName);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams, paramName]);

  return {
    isNew: value === "new",
    openId: value && value !== "new" ? value : null,
    hrefFor,
    close,
  };
}
