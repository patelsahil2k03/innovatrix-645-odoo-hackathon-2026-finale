/**
 * Pure aggregation over an already-computed budget's lines — the achieved
 * figures themselves come from the server (03_DATA_MODEL.md §2), this only
 * rolls several lines up into one number for the list screen's donut column.
 * Kept out of the .tsx per RULES.md §8.
 */

import type { BudgetLine } from "@/lib/api";

export interface BudgetAggregate {
  committed: number;
  achieved: number;
  achievedPct: number;
}

export function aggregateBudgetLines(lines: BudgetLine[]): BudgetAggregate {
  const committed = lines.reduce((sum, line) => sum + line.committed_amount, 0);
  const achieved = lines.reduce((sum, line) => sum + (line.achieved_amount ?? 0), 0);
  return {
    committed,
    achieved,
    achievedPct: committed > 0 ? (achieved / committed) * 100 : 0,
  };
}

export type BudgetAchievedTone = "ok" | "warn" | "danger";

/** Below this, a line is comfortably on track; at/above it, it's approaching its limit. */
const NEAR_LIMIT_PCT = 85;

/**
 * The traffic-light read on an achieved percentage against its committed
 * amount — on track, approaching the limit, or over it. One rule, used
 * everywhere achieved % is shown (the list donut and the line table), so a
 * budget never reads "fine" in one place and "over" in another.
 */
export function budgetAchievedTone(achievedPct: number): BudgetAchievedTone {
  if (achievedPct > 100) return "danger";
  if (achievedPct >= NEAR_LIMIT_PCT) return "warn";
  return "ok";
}

/** 0–70%: green fading to amber. */
const GREEN_TO_AMBER_END = 70;
/** 70–100%: amber fading to red. */
const AMBER_TO_RED_END = 100;
/** 100%+: red keeps darkening (more red the further over) until it caps here. */
const RED_SATURATE_END = 400;
/** How dark the most-over-budget case gets — capped short of black so the ring stays legible. */
const MAX_DARKEN_PCT = 55;

/**
 * A continuous green→amber→red read on an achieved percentage, instead of
 * `budgetAchievedTone`'s three flat buckets — used where the ring itself is
 * the whole point (the donut), so a budget at 420% reads visibly worse than
 * one at 105% rather than both just being "danger". Zero or negative (a net
 * credit/reversal can push achieved below zero) reads as the safest green;
 * beyond `RED_SATURATE_END` it stops getting darker so a 1000% outlier
 * doesn't wash out to unreadable black. Mixes the app's own `--ok`/`--warn`/
 * `--danger` tokens via `color-mix()` rather than hardcoding hues, so it
 * still adapts to light/dark theme automatically.
 */
export function budgetAchievedColor(achievedPct: number): string {
  if (achievedPct <= 0) return "var(--ok)";
  if (achievedPct < GREEN_TO_AMBER_END) {
    const t = Math.round((achievedPct / GREEN_TO_AMBER_END) * 100);
    return `color-mix(in srgb, var(--warn) ${t}%, var(--ok))`;
  }
  if (achievedPct < AMBER_TO_RED_END) {
    const t = Math.round(((achievedPct - GREEN_TO_AMBER_END) / (AMBER_TO_RED_END - GREEN_TO_AMBER_END)) * 100);
    return `color-mix(in srgb, var(--danger) ${t}%, var(--warn))`;
  }
  const t = Math.round(
    Math.min(1, (achievedPct - AMBER_TO_RED_END) / (RED_SATURATE_END - AMBER_TO_RED_END)) * MAX_DARKEN_PCT,
  );
  return `color-mix(in srgb, black ${t}%, var(--danger))`;
}
