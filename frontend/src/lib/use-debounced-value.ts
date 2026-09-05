"use client";

import { useEffect, useState } from "react";

/**
 * Debounce a rapidly-changing value (search boxes, sliders).
 *
 * USE THIS FOR EVERY SEARCH INPUT. Without it, each keystroke fires an API call:
 * the server gets hammered and responses can arrive out of order, so the list
 * flickers back to stale results. Both happened in the last hackathon build.
 *
 *   const [search, setSearch] = useState("");
 *   const debouncedSearch = useDebouncedValue(search, 300);
 *   const { data } = useFetch(() => api.things.list({ q: debouncedSearch }),
 *                             [debouncedSearch]);   // ← debounced value in deps
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
