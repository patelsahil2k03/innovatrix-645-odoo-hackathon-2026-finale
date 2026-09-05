"use client";

/**
 * Renders the four states every data view has: loading, error, empty, and content.
 *
 * Wrapping them here means no screen can accidentally ship a blank white box when a
 * request fails — a real failure mode in the previous build.
 */

interface AsyncStateProps<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
  /** Treated as empty when this returns true. */
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyHint?: string;
  onRetry?: () => void;
  children: (data: T) => React.ReactNode;
}

export function AsyncState<T>({
  loading, error, data, isEmpty, emptyTitle = "Nothing here yet",
  emptyHint, onRetry, children,
}: AsyncStateProps<T>) {
  if (loading) {
    return (
      <div className="stack" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading…</span>
        {[0, 1, 2].map((row) => (
          <div key={row} className="skeleton" style={{ height: 44 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="state" role="alert">
        <span className="state-title">Couldn&apos;t load this</span>
        <span className="state-sub">{error}</span>
        {onRetry ? (
          <button type="button" className="btn btn-sm" onClick={onRetry}>Try again</button>
        ) : null}
      </div>
    );
  }

  if (!data || (isEmpty && isEmpty(data))) {
    return (
      <div className="state">
        <span className="state-title">{emptyTitle}</span>
        {emptyHint ? <span className="state-sub">{emptyHint}</span> : null}
      </div>
    );
  }

  return <>{children(data)}</>;
}
