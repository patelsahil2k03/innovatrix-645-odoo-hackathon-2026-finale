/**
 * KPI tiles.
 *
 * ⚠️ Feed `value` from the API's `total`, never from `items.length` — `items` is one
 * page, so using it silently under-reports every count past the first page. That
 * exact bug shipped in the previous build.
 */

interface Kpi {
  label: string;
  value: string | number;
  sub?: string;
}

export function KpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="kpi-grid">
      {items.map((kpi) => (
        <div key={kpi.label} className="kpi">
          <span className="kpi-label">{kpi.label}</span>
          <span className="kpi-value">{kpi.value}</span>
          {kpi.sub ? <span className="kpi-sub">{kpi.sub}</span> : null}
        </div>
      ))}
    </div>
  );
}
