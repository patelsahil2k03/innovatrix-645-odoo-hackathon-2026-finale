"use client";

/**
 * The Budget list's pie-chart column (05_FRONTEND.md §2.1). Plain inline SVG —
 * no charting dependency for one ring. The swept angle is data, computed here
 * from already-computed achieved_pct, not a design decision, so it's the one
 * place a numeric style value is inline rather than a token.
 */

import { percent } from "@/lib/format";

export function BudgetDonut({ achievedPct, size = 40 }: { achievedPct: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, achievedPct));
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  const overBudget = achievedPct > 100;

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={overBudget ? "var(--danger)" : "var(--accent)"}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="donut-label">{percent(achievedPct, 0)}</span>
    </div>
  );
}
