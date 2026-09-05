"use client";

/**
 * Shimmering placeholder blocks (`.skeleton` in design-system.css) composed
 * into the shapes real content takes. Pages pass one of these to
 * `<AsyncState skeleton={...}>` instead of hand-rolling a shimmer div —
 * that's how every screen ends up with a loading state shaped like its
 * actual content instead of a generic grey box.
 */

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({ width = "100%", height = 16, className }: SkeletonProps) {
  return (
    <div
      className={className ? `skeleton ${className}` : "skeleton"}
      style={{ width, height }}
    />
  );
}

/** A handful of shimmering text lines, the last one shorter. */
export function SkeletonText({ lines = 3, lastLineWidth = "60%" }: { lines?: number; lastLineWidth?: string }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={14} width={i === lines - 1 ? lastLineWidth : "100%"} />
      ))}
    </div>
  );
}

/** Row-and-column shimmer standing in for a `<table className="data-table">`. */
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="row" style={{ gap: 16 }}>
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton key={col} height={16} width={col === 0 ? "16%" : `${Math.round(84 / (columns - 1 || 1))}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A card-shaped shimmer for a detail/form screen: a title bar plus body lines. */
export function SkeletonCard({ lines = 4 }: { lines?: number }) {
  return (
    <div className="card stack">
      <Skeleton height={20} width="30%" />
      <SkeletonText lines={lines} />
    </div>
  );
}

/** Standing in for a `<KpiGrid>` row of stat tiles. */
export function SkeletonKpiGrid({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="row" style={{ gap: 16 }}>
      {Array.from({ length: tiles }).map((_, i) => (
        <div key={i} className="card stack" style={{ flex: 1, minWidth: 160 }}>
          <Skeleton height={12} width="50%" />
          <Skeleton height={24} width="70%" />
        </div>
      ))}
    </div>
  );
}
