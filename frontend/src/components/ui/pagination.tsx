"use client";

import { ChevronLeft, ChevronRight } from "@/components/icons";

interface PaginationProps {
  page: number;
  pages: number;
  /** TOTAL matching rows, not the current page length. */
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pages, total, pageSize, onPageChange }: PaginationProps) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span className="pagination-info">
        Showing {first}–{last} of {total}
      </span>
      <div className="row" style={{ gap: 6 }}>
        <button
          type="button" className="btn btn-sm"
          onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </button>
        <span className="pagination-info" aria-live="polite">Page {page} of {pages}</span>
        <button
          type="button" className="btn btn-sm"
          onClick={() => onPageChange(page + 1)} disabled={page >= pages}
          aria-label="Next page"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}
