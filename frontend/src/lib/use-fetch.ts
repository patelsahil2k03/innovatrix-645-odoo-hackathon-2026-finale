"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api";

interface FetchState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Call after a mutation to re-run the fetch. */
  reload: () => void;
}

interface InternalState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Loading / error / data for a page's primary API call.
 *
 * `deps` behaves like a useEffect dependency array. Put every filter, sort and page
 * value in it — and pass the DEBOUNCED search value, not the raw input, or you fire
 * one request per keystroke.
 *
 * State is kept in a SINGLE object so each transition is one render rather than
 * three separate setState calls cascading. The request also runs inside a nested
 * async function so the effect body itself stays synchronous and side-effect free.
 */
export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [state, setState] = useState<InternalState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setState((previous) => ({ ...previous, loading: true, error: null }));
      try {
        const result = await fetcher();
        // Guard against an earlier request resolving after a later one and
        // overwriting fresh data with stale data.
        if (!cancelled) setState({ data: result, error: null, loading: false });
      } catch (error: unknown) {
        if (cancelled) return;
        setState({
          data: null,
          error: error instanceof ApiError ? error.message : "Something went wrong.",
          loading: false,
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  return { ...state, reload };
}
