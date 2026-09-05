"use client";

import { useMemo, useState } from "react";

/**
 * Client-side search / sort / paginate for a SMALL list already in memory
 * (a detail page's sub-table, for example).
 *
 * For a main list endpoint, do NOT use this — pass page/sort/q to the API instead so
 * the server does the work and the totals stay correct beyond the first page.
 */
export function usePagedRows<T extends Record<string, unknown>>(
  rows: T[],
  options: { pageSize?: number; searchKeys?: (keyof T)[] } = {},
) {
  const { pageSize = 10, searchKeys = [] } = options;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDesc, setSortDesc] = useState(false);

  // Dependency lists must be simple expressions, so derive the key first.
  const searchKeysKey = searchKeys.join(",");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle || searchKeys.length === 0) return rows;
    return rows.filter((row) =>
      searchKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, searchKeysKey]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (left === right) return 0;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      const result = left < right ? -1 : 1;
      return sortDesc ? -result : result;
    });
  }, [filtered, sortKey, sortDesc]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pages);
  const items = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(false);
    }
    setPage(1);
  }

  return {
    items,
    page: safePage,
    pages,
    total: sorted.length,
    search,
    sortKey,
    sortDesc,
    setPage,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    toggleSort,
  };
}
