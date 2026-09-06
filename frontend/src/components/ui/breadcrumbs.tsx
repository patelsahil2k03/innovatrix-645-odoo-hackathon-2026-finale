"use client";

import Link from "next/link";

import { ChevronRight } from "@/components/icons";

/**
 * The trail shown above every screen's title. Every crumb but the last is a
 * real link (05_FRONTEND.md §6 — "the trail is breadcrumbed, and every level
 * is a real URL you can reload and share"). The last crumb is the current
 * screen: plain text, `aria-current="page"`.
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="row" style={{ gap: 6 }}>
            {index > 0 ? <ChevronRight size={12} className="sep" /> : null}
            {item.href && !isLast ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
