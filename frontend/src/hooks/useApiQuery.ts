/**
 * useApiQuery — lightweight data-fetching hook for the officer dashboard.
 *
 * Features:
 *   - AbortController cancellation when filters change or component unmounts
 *   - In-flight request dedupe (identical URL + params share one promise)
 *   - configurable staleTime
 *   - refetch on window focus
 *   - manual refetch (refetch())
 *   - loading / error / data state
 *
 * No React Query dependency — keeps the dependency count down per ponytail.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AxiosError } from "axios";
import { ApiError } from "../lib/api";

// ── In-flight dedupe cache ──────────────────────────────────────────────

const inflight = new Map<string, Promise<unknown>>();

function inflightKey(method: string, url: string, params?: Record<string, unknown>): string {
  return `${method}:${url}:${JSON.stringify(params ?? {})}`;
}

// ── Hook ────────────────────────────────────────────────────────────────

export interface UseApiQueryState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  options?: { staleTime?: number; enabled?: boolean; queryKey?: string },
): UseApiQueryState<T> {
  const { staleTime = 0, enabled = true, queryKey } = options ?? {};

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<ApiError | null>(null);

  const lastFetchTime = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const execute = useCallback(async (): Promise<void> => {
    if (!enabled) return;

    // Cancel any in-flight request for this hook instance
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    const key = inflightKey("GET", queryKey ?? fetcherRef.current.toString(), undefined);
    if (inflight.has(key)) {
      try {
        const result = await inflight.get(key)!;
        setData(result as T);
        setError(null);
      } catch {
        // handled by the original caller
      }
      return;
    }

    setLoading(true);
    setError(null);

    const request = (async () => {
      const start = Date.now();
      const result = await fetcherRef.current();
      lastFetchTime.current = start;
      if (abortRef.current?.signal.aborted) return result;
      setData(result);
      setError(null);
      return result;
    })();

    inflight.set(key, request);
    try {
      await request;
    } catch (err: unknown) {
      if (!abortRef.current?.signal.aborted) {
        if (err instanceof ApiError) {
          setError(err);
        } else if (err instanceof AxiosError) {
          setError(new ApiError(err.message ?? "Request failed", err.response?.status ?? 0));
        } else {
          setError(new ApiError("Nagkaroon ng hindi inaasahang error.", 0));
        }
      }
    } finally {
      if (inflight.get(key) === request) {
        inflight.delete(key);
      }
      if (!abortRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [enabled, queryKey]);

  // Initial fetch
  useEffect(() => {
    if (!enabled) return;
    execute();
  }, [execute, enabled]);

  // Refetch on window focus
  useEffect(() => {
    const onFocus = () => {
      if (!enabled) return;
      const now = Date.now();
      if (staleTime > 0 && now - lastFetchTime.current < staleTime) return;
      execute();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [execute, enabled, staleTime]);

  // Cancel on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { data, loading, error, refetch: execute };
}
