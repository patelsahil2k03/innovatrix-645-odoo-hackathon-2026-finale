"use client";

/**
 * Trial balance alert — lives in the sidebar footer, updates over SSE on
 * `ledger.changed` (05_FRONTEND.md §6). Renders nothing while balanced: the
 * footer only has room for one status signal alongside the sign-out
 * controls, and a real imbalance is the one that actually needs a user's
 * attention. If it ever goes red, something real is wrong — never fake it
 * green, and never suppress the danger state.
 */

import { AlertTriangleIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { money } from "@/lib/format";
import { useEventStream } from "@/lib/use-event-stream";
import { useFetch } from "@/lib/use-fetch";

export function TrialBalanceBadge() {
  const { user } = useAuth();
  // No session yet → skip the call rather than 401. Loading/error/balanced all
  // render nothing (see the null returns below), so a missing session is
  // already covered correctly.
  const trialBalance = useFetch(
    () => (user ? api.reports.trialBalance() : Promise.resolve(null)),
    [user],
  );
  useEventStream({ "ledger.changed": () => trialBalance.reload() }, !!user);

  if (trialBalance.loading || trialBalance.error || !trialBalance.data) {
    return null;
  }

  const { is_balanced, difference } = trialBalance.data;

  if (is_balanced) return null;

  return (
    <span className="badge badge-danger" role="alert">
      <AlertTriangleIcon size={12} />
      Trial balance off by {money(Math.abs(difference))}
    </span>
  );
}
