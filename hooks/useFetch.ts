'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFetchOptions {
  /** Skip the initial fetch (useful for conditional fetching) */
  skip?: boolean;
  /** Dependencies that trigger a refetch when changed */
  deps?: unknown[];
}

interface UseFetchReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Reusable hook for data fetching with loading/error state management.
 * Replaces the repeated useState/useEffect/fetch pattern across components.
 *
 * @param url - API endpoint URL (pass null to skip fetching)
 * @param options - Configuration options
 */
export function useFetch<T>(url: string | null, options?: UseFetchOptions): UseFetchReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options?.skip && url !== null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `Error ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError(err?.message ?? 'Error desconocido');
      setData(null);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [url]);

  useEffect(() => {
    if (options?.skip || url === null) {
      setLoading(false);
      return;
    }
    fetchData();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, ...(options?.deps ?? [])]);

  return { data, loading, error, refetch: fetchData };
}

interface UsePollingOptions {
  /** Polling interval in ms (default: 30000) */
  interval?: number;
  /** Skip polling when true */
  skip?: boolean;
}

/**
 * Hook for polling an endpoint with activity-aware intervals.
 * Pauses polling when the tab is not visible to save resources.
 */
export function usePollingFetch<T>(
  url: string | null,
  options?: UsePollingOptions,
): UseFetchReturn<T> {
  const result = useFetch<T>(url, { skip: options?.skip });
  const intervalMs = options?.interval ?? 30000;

  useEffect(() => {
    if (options?.skip || !url) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      timeoutId = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          result.refetch().finally(scheduleNext);
        } else {
          scheduleNext();
        }
      }, intervalMs);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        result.refetch();
      }
    };

    scheduleNext();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, intervalMs, options?.skip]);

  return result;
}
