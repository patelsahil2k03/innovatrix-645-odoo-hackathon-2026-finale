/** Display formatting. Keep every user-facing number/date going through here so
 *  the whole app is consistent — mixed formats read as sloppy at a glance. */

// 05_FRONTEND.md §4: always two decimals, always grouped — ₹1,25,000.00, never
// rounded. Never use toFixed() inline; every screen goes through this helper.
const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const money = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : INR.format(value);

export const number = (value: number | null | undefined, decimals = 0): string =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);

export const percent = (value: number | null | undefined, decimals = 0): string =>
  value === null || value === undefined ? "—" : `${value.toFixed(decimals)}%`;

/** Guarded division — avoids rendering "Infinity" or "NaN" when a denominator is 0. */
export const ratio = (numerator: number, denominator: number, decimals = 2): string =>
  !denominator ? "—" : (numerator / denominator).toFixed(decimals);

export const date = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const dateTime = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
};

/** "3 days ago" / "in 5 days" — good for expiry and activity columns. */
export const relative = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";

  const diffDays = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  return diffDays > 0 ? `in ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
};

/** Turn "in_progress" / "IN_PROGRESS" into "In progress" for display. */
export const humanize = (value: string | null | undefined): string =>
  !value ? "—" : value.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
