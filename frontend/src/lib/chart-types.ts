"use client";

/**
 * What a user is allowed to switch a chart *to*, and why the list is not the
 * same everywhere.
 *
 * The tempting version of "let the user change the chart type" offers every
 * type on every chart. That produces charts that lie. A pie of twelve monthly
 * revenue figures implies the months are parts of a whole that sum to something
 * meaningful; they are a sequence, and the reader loses the one thing the data
 * actually shows — direction over time. So the options are a property of the
 * data's SHAPE, not a global list:
 *
 *   series      a measure over time      → line · area · bar
 *   composition parts of one total       → donut · bar
 *   ranking     ordered comparison       → bar
 *
 * Every option within a shape is a different encoding of the same true
 * statement, so switching can never mislead. Living here rather than in the
 * component keeps the rule testable and stops a future screen quietly
 * offering a fourth option that breaks it (brain/RULES.md §8).
 */

export type ChartKind = "line" | "area" | "bar" | "donut";
export type DataShape = "series" | "composition" | "ranking";

export const CHART_OPTIONS: Record<DataShape, readonly ChartKind[]> = {
  series: ["line", "area", "bar"],
  composition: ["donut", "bar"],
  ranking: ["bar"],
};

export const CHART_LABELS: Record<ChartKind, string> = {
  line: "Line",
  area: "Area",
  bar: "Bar",
  donut: "Donut",
};

/**
 * The categorical ramp, as CSS variable references.
 *
 * Deliberately `var(--chart-N)` strings rather than resolved hex: Recharts
 * writes these straight into SVG `fill`/`stroke` presentation attributes, where
 * `var()` resolves natively. Light/dark switching therefore costs no JavaScript
 * at all — no reading computed styles, no re-render on theme change, which is
 * exactly what a canvas-based chart library would have forced.
 */
export const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

/**
 * Income and expense are two values of the ONE accent hue, not two hues.
 *
 * The obvious encoding is green for income and red for expense, and it was
 * wrong here: it imports a second and third colour into a product whose whole
 * visual argument is a single blue accent (DESIGN.md, "Don't introduce a second
 * accent color"). Two ends of one ramp separate the series just as clearly on a
 * chart that has a legend and a tooltip, and the screen stays blue and white.
 */
export const INCOME_COLOR = "var(--chart-1)";
export const EXPENSE_COLOR = "var(--chart-4)";
export const ACCENT_COLOR = "var(--chart-1)";
/** A loss stays in-palette — it is dimmed, not recoloured. */
export const NEGATIVE_COLOR = "var(--chart-5)";
export const GRID_COLOR = "var(--chart-grid)";
export const AXIS_COLOR = "var(--chart-axis)";

/** Colour for slice `index`, wrapping if a breakdown ever outgrows the ramp. */
export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

/**
 * Compact money for axis ticks — `₹12.4L`, not `₹12,40,000`.
 *
 * Uses the Indian lakh/crore scale rather than K/M because every other figure
 * on screen is already grouped `12,40,000` by `format.ts`. Mixing scales inside
 * one screen is how a reader mis-reads an axis by two orders of magnitude.
 */
export function compactMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(0)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}
