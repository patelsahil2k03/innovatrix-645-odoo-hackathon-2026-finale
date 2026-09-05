"use client";

/**
 * The Budget list's "Achieved" indicator (05_FRONTEND.md §2.1) — a ring with
 * the percentage set inside it. Plain inline SVG, no charting dependency for one ring.
 */

import { percent } from "@/lib/format";

export function BudgetDonut({
  achievedPct,
  size = 48,
  color = "var(--accent)",
}: {
  achievedPct: number;
  size?: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, achievedPct));
  const strokeWidth = Math.max(3, Math.round(size / 14));
  const radius = size / 2 - strokeWidth - 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <div className="donut-wrap" role="img" aria-label={`${percent(achievedPct, 0)} achieved`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="donut-label"
          fill={color}
          fontSize={Math.max(10, size * 0.22)}
          fontWeight={500}
        >
          {percent(achievedPct, 0)}
        </text>
      </svg>
    </div>
  );
}

