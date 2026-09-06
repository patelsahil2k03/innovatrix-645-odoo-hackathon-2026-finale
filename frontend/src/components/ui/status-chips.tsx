"use client";

/**
 * A row of state chips with counts — "All 40 · Draft 4 · Confirmed 5" — as the
 * mockup draws beside each module (PROBLEM_STATEMENT.md §4 item 14).
 *
 * Presentation only. It decides nothing: which chips exist, their order and
 * their labels all arrive from `useStatusCounts()`, and where a chip points is
 * the caller's `hrefFor` (brain/RULES.md §8).
 */

import Link from "next/link";

import type { StatusChip } from "@/lib/use-status-counts";

interface StatusChipsProps {
  chips: StatusChip[];
  /** The state currently filtering the view, or null for "All". */
  active?: string | null;
  /** Link target for a chip. Omit to render plain, unclickable counts. */
  hrefFor?: (status: string | null) => string;
  "aria-label"?: string;
}

export function StatusChips({ chips, active = null, hrefFor, ...rest }: StatusChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="status-chips" role="group" aria-label={rest["aria-label"] ?? "Counts by state"}>
      {chips.map((chip) => {
        const isActive = (chip.status ?? null) === (active ?? null);
        const content = (
          <>
            <span className="status-chip-label">{chip.label}</span>
            <span className="status-chip-count">{chip.count}</span>
          </>
        );

        if (!hrefFor) {
          return (
            <span key={chip.label} className="status-chip" data-active={isActive}>
              {content}
            </span>
          );
        }

        return (
          <Link
            key={chip.label}
            href={hrefFor(chip.status)}
            className="status-chip"
            data-active={isActive}
            aria-current={isActive ? "true" : undefined}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}
