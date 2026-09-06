"use client";

/**
 * Sortable table header.
 *
 * Sets `aria-sort` on the <th> — without it a screen-reader user has no idea which
 * column is sorted or in which direction, because the ▲/▼ glyph is sighted-only.
 */

interface SortableThProps {
  label: string;
  sortKey: string;
  /** Current sort, API style: "field" or "-field". */
  current: string | null | undefined;
  onSort: (nextSort: string) => void;
  align?: "left" | "right";
}

export function SortableTh({ label, sortKey, current, onSort, align = "left" }: SortableThProps) {
  const isActive = current === sortKey || current === `-${sortKey}`;
  const isDescending = current === `-${sortKey}`;

  const ariaSort = !isActive ? "none" : isDescending ? "descending" : "ascending";

  return (
    <th aria-sort={ariaSort} style={{ textAlign: align }}>
      <button
        type="button"
        className="th-sort"
        onClick={() => onSort(isActive && !isDescending ? `-${sortKey}` : sortKey)}
      >
        {label}
        <span className="th-sort-arrow" aria-hidden="true">
          {isActive ? (isDescending ? "▼" : "▲") : "↕"}
        </span>
      </button>
    </th>
  );
}
