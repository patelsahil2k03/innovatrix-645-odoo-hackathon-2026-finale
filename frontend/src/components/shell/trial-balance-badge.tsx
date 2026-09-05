"use client";

/**
 * "Trial balance 0.00 ✓" — lives in the shell, visible on every screen, and
 * updates over SSE on `ledger.changed` (05_FRONTEND.md §6). It is evidence,
 * not a claim made once: if it ever goes red, something real is wrong — never
 * hide it, never fake it green.
 */

import { AlertTriangleIcon, CheckCircleIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";

export function TrialBalanceBadge() {
  const trialBalance = useFetch(() => api.reports.trialBalance(), []);
  useEventStream({ "ledger.changed": () => trialBalance.reload() });

  if (trialBalance.loading) {
    return <span className="badge badge-neutral">Trial balance …</span>;
  }

  if (trialBalance.error || !trialBalance.data) {
    return <span className="badge badge-neutral">Trial balance —</span>;
  }

  const { is_balanced, difference } = trialBalance.data;

  return is_balanced ? (
    <span className="badge badge-ok">
      <CheckCircleIcon size={12} />
      Trial balance {money(0)}
    </span>
  ) : (
    <span className="badge badge-danger" role="alert">
      <AlertTriangleIcon size={12} />
      Trial balance off by {money(Math.abs(difference))}
    </span>
  );
}
