"use client";

/**
 * Kanban card grid for Contact · Product · Analyticals · Budget
 * (05_FRONTEND.md §2.1). "A Kanban card is the same record rendered as a card —
 * image or initials, name, and two secondary lines." Purely presentational —
 * the page decides what goes in each slot, this only lays cards out.
 */

import Link from "next/link";

export interface KanbanCardData {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  imageUrl?: string | null;
  href: string;
  badge?: React.ReactNode;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function KanbanGrid({ items }: { items: KanbanCardData[] }) {
  return (
    <div className="kanban-grid">
      {items.map((item) => (
        <Link key={item.id} href={item.href} className="kanban-card">
          <div className="kanban-avatar" aria-hidden="true">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" />
            ) : (
              <span>{initials(item.title)}</span>
            )}
          </div>
          <div className="kanban-body">
            <span className="kanban-title">{item.title}</span>
            {item.subtitle ? <span className="kanban-subtitle">{item.subtitle}</span> : null}
            {item.meta ? <span className="kanban-meta">{item.meta}</span> : null}
          </div>
          {item.badge}
        </Link>
      ))}
    </div>
  );
}
