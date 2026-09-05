/**
 * Horizontal bar charts — plain HTML/CSS, no charting dependency (same call
 * as `BudgetDonut`). Bar length is a magnitude comparison, always scaled to
 * the largest value in the set so the reader can compare bars at a glance.
 * Every value is a direct label, so nothing here is gated behind hover.
 *
 * `CategoryBarChart` — one bar per row, each row its own colour (the rows
 * ARE the categories, e.g. Assets / Liabilities / Equity).
 * `GroupedBarChart` — two bars per row sharing one colour pair across every
 * row (e.g. Committed vs. Achieved per analytic account) — carries a legend
 * since the same colour repeats across rows.
 */

import { money } from "@/lib/format";

export function CategoryBarChart({
  items,
}: {
  items: { label: string; value: number; colorVar: string }[];
}) {
  const max = Math.max(1, ...items.map((item) => Math.abs(item.value)));
  return (
    <div className="hbar-chart" role="img" aria-label={items.map((i) => `${i.label} ${money(i.value)}`).join(", ")}>
      {items.map((item) => (
        <div className="hbar-row" key={item.label}>
          <span className="hbar-name">{item.label}</span>
          <div className="hbar-bars">
            <div className="hbar-track">
              <div
                className="hbar-fill"
                style={{ width: `${(Math.abs(item.value) / max) * 100}%`, background: item.colorVar }}
              />
            </div>
          </div>
          <span className="hbar-value">{money(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function GroupedBarChart({
  series,
  rows,
}: {
  series: [{ label: string; colorVar: string }, { label: string; colorVar: string }];
  rows: { label: string; values: [number, number] }[];
}) {
  const max = Math.max(1, ...rows.flatMap((row) => row.values.map(Math.abs)));
  return (
    <div>
      <div className="hbar-legend">
        {series.map((s) => (
          <span className="hbar-legend-item" key={s.label}>
            <span className="hbar-legend-swatch" style={{ background: s.colorVar }} />
            {s.label}
          </span>
        ))}
      </div>
      <div
        className="hbar-chart"
        role="img"
        aria-label={rows
          .map((row) => `${row.label}: ${series[0].label} ${money(row.values[0])}, ${series[1].label} ${money(row.values[1])}`)
          .join("; ")}
      >
        {rows.map((row) => (
          <div className="hbar-row" key={row.label}>
            <span className="hbar-name" title={row.label}>{row.label}</span>
            <div className="hbar-bars">
              {row.values.map((value, i) => (
                <div className="hbar-track" key={series[i].label}>
                  <div
                    className="hbar-fill"
                    style={{ width: `${(Math.abs(value) / max) * 100}%`, background: series[i].colorVar }}
                  />
                </div>
              ))}
            </div>
            <span className="hbar-value">{money(row.values[0])} / {money(row.values[1])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
