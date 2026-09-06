/**
 * KPI tiles.
 *
 * ⚠️ Feed `value` from the API's `total`, never from `items.length` — `items` is one
 * page, so using it silently under-reports every count past the first page. That
 * exact bug shipped in the previous build.
 *
 * A tile with an `href` becomes a real <Link> to wherever that figure came
 * from, matching the report drill-down (05_FRONTEND.md §6): a number you can
 * click is a number you can verify. Tiles without one stay plain <div>s rather
 * than dead links — a card that looks clickable and does nothing is worse than
 * one that never invited the click.
 */

import Link from "next/link";

interface Kpi {
  label: string;
  value: string | number;
  sub?: string;
  /** Where this figure comes from. Omit for a non-navigable tile. */
  href?: string;
}

export function KpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="kpi-grid">
      {items.map((kpi) => {
        const body = (
          <>
            <span className="kpi-label">{kpi.label}</span>
            <span className="kpi-value">{kpi.value}</span>
            {kpi.sub ? <span className="kpi-sub">{kpi.sub}</span> : null}
          </>
        );

        return kpi.href ? (
          <Link key={kpi.label} href={kpi.href} className="kpi kpi-link">
            {body}
          </Link>
        ) : (
          <div key={kpi.label} className="kpi">
            {body}
          </div>
        );
      })}
    </div>
  );
}
