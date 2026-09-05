"use client";

/**
 * The frame every chart sits in: title, optional right-hand control, and the
 * chart-type switcher.
 *
 * The switcher only renders when there is a real choice to make — a ranking has
 * exactly one honest encoding, and a control with a single option is noise
 * pretending to be a feature. Which options exist is decided in
 * `lib/chart-types.ts`, not here.
 */

import type { ReactNode } from "react";

import { CHART_LABELS, type ChartKind } from "@/lib/chart-types";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Omit, or pass a single-entry list, to hide the switcher entirely. */
  options?: readonly ChartKind[];
  active?: ChartKind;
  onSelect?: (kind: ChartKind) => void;
  /** Extra control shown left of the switcher — a range select, a toggle. */
  action?: ReactNode;
  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  options,
  active,
  onSelect,
  action,
  children,
}: ChartCardProps) {
  const showSwitcher = !!options && options.length > 1 && !!onSelect;

  return (
    <section className="card chart-card">
      <header className="chart-card-head">
        <div className="chart-card-titles">
          <h2 className="card-title">{title}</h2>
          {subtitle ? <p className="chart-card-sub">{subtitle}</p> : null}
        </div>

        <div className="chart-card-controls">
          {action}
          {showSwitcher ? (
            <div
              className="chart-switch"
              role="group"
              aria-label={`${title} chart type`}
            >
              {options.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="chart-switch-btn"
                  aria-pressed={active === kind}
                  onClick={() => onSelect(kind)}
                >
                  {CHART_LABELS[kind]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div className="chart-card-body">{children}</div>
    </section>
  );
}
