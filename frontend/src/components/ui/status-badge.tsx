/**
 * Status pill.
 *
 * Colour AND a dot AND text — never colour alone, so the status is still readable
 * for colour-blind users and in a greyscale screenshot.
 */

import { humanize } from "@/lib/format";

type Tone = "ok" | "warn" | "danger" | "info" | "neutral";

/** ★ Map your problem statement's status values to a tone. */
const TONE_BY_STATUS: Record<string, Tone> = {
  active: "ok", available: "ok", approved: "ok", completed: "ok", done: "ok", paid: "ok",
  pending: "warn", draft: "warn", in_progress: "info", processing: "info", dispatched: "info",
  cancelled: "danger", rejected: "danger", failed: "danger", expired: "danger", suspended: "danger",
  archived: "neutral", inactive: "neutral", retired: "neutral",
};

export function StatusBadge({ status, tone }: { status: string; tone?: Tone }) {
  const resolved = tone ?? TONE_BY_STATUS[status?.toLowerCase()] ?? "neutral";
  return <span className={`badge badge-${resolved}`}>{humanize(status)}</span>;
}
