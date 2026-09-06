"use client";

/**
 * Every figure on a report is a link (05_FRONTEND.md §6) — the drill-down is
 * the one "wow", so it has to look like a normal number until you notice it
 * behaves like a link. A real <Link>, not a button, so it's a real URL you can
 * reload and share.
 */

import Link from "next/link";

import { money } from "@/lib/format";

export function DrillAmount({ value, href }: { value: number; href: string }) {
  return (
    <Link href={href} className="drill-amount">
      {money(value)}
    </Link>
  );
}
