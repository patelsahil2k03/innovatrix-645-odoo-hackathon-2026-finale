"use client";

/**
 * "Trial balance 0.00 ✓" — lives in the shell, visible on every screen, and
 * updates over SSE on `ledger.changed` (05_FRONTEND.md §6). It is evidence,
 * not a claim made once: if it ever goes red, something real is wrong — never
 * hide it, never fake it green.
 */

import { AlertTriangleIcon, CheckCircleIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { money } from "@/lib/format";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";

export function TrialBalanceBadge() {
  const { user } = useAuth();
  // No session yet → skip the call rather than 401. The badge's own loading/error
  // fallback ("Trial balance —") already covers a null result correctly.
  const trialBalance = useFetch(
    () => (user ? api.reports.trialBalance() : Promise.resolve(null)),
    [user],
  );
  useEventStream({ "ledger.changed": () => trialBalance.reload() }, !!user);

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
