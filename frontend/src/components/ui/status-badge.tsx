/**
 * Status pill.
 *
 * Colour AND an icon AND text — never colour alone, so the status is still
 * readable for colour-blind users and in a greyscale screenshot.
 */

import type { ComponentType } from "react";
import {
  ArchiveIcon, BadgeCheckIcon, BookCheckIcon, CheckCircleIcon, CircleDashedIcon,
  ClipboardCheckIcon, ClockIcon, EditIcon, HistoryIcon, LoaderIcon, PieChartIcon,
  ReceiptIcon, TruckIcon, XCircleIcon, AlertTriangleIcon,
} from "@/components/icons";
import { humanize } from "@/lib/format";

type Tone = "ok" | "warn" | "danger" | "info" | "neutral";
type Icon = ComponentType<{ size?: number; className?: string }>;

/** ★ Map your problem statement's status values to a tone + icon. */
const STATUS_CONFIG: Record<string, { tone: Tone; icon: Icon }> = {
  // ok — final, settled, good state
  active: { tone: "ok", icon: CheckCircleIcon },
  available: { tone: "ok", icon: CheckCircleIcon },
  approved: { tone: "ok", icon: CheckCircleIcon },
  completed: { tone: "ok", icon: CheckCircleIcon },
  done: { tone: "ok", icon: CheckCircleIcon },
  confirmed: { tone: "ok", icon: ClipboardCheckIcon },
  paid: { tone: "ok", icon: BadgeCheckIcon },
  posted: { tone: "ok", icon: BookCheckIcon },

  // warn — not yet final, needs attention
  pending: { tone: "warn", icon: ClockIcon },
  draft: { tone: "warn", icon: EditIcon },
  partial: { tone: "warn", icon: PieChartIcon },

  // info — moved forward in the workflow, on the way to closed
  in_progress: { tone: "info", icon: LoaderIcon },
  processing: { tone: "info", icon: LoaderIcon },
  dispatched: { tone: "info", icon: TruckIcon },
  billed: { tone: "info", icon: ReceiptIcon },
  invoiced: { tone: "info", icon: ReceiptIcon },
  revised: { tone: "info", icon: HistoryIcon },

  // danger — stopped, failed, rejected
  cancelled: { tone: "danger", icon: XCircleIcon },
  rejected: { tone: "danger", icon: XCircleIcon },
  failed: { tone: "danger", icon: XCircleIcon },
  expired: { tone: "danger", icon: AlertTriangleIcon },
  suspended: { tone: "danger", icon: AlertTriangleIcon },

  // neutral — inactive, historical
  archived: { tone: "neutral", icon: ArchiveIcon },
  inactive: { tone: "neutral", icon: CircleDashedIcon },
  retired: { tone: "neutral", icon: CircleDashedIcon },
};

/** Fallback icon when a status string isn't in the map above but a tone is known. */
const ICON_BY_TONE: Record<Tone, Icon> = {
  ok: CheckCircleIcon, warn: ClockIcon, danger: XCircleIcon, info: LoaderIcon, neutral: CircleDashedIcon,
};

export function StatusBadge({ status, tone }: { status: string; tone?: Tone }) {
  const config = STATUS_CONFIG[status?.toLowerCase()];
  const resolvedTone = tone ?? config?.tone ?? "neutral";
  const Icon = config?.icon ?? ICON_BY_TONE[resolvedTone];
  return (
    <span className={`badge badge-icon badge-${resolvedTone}`}>
      <Icon size={12} />
      {humanize(status)}
    </span>
  );
}
