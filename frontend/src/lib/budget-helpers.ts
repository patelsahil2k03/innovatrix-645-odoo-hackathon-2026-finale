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
