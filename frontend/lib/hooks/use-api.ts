"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResponse } from "@/lib/services/api-client";

// ---------------------------------------------------------------------------
// Generic API hook state
// ---------------------------------------------------------------------------

export interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

export interface UseApiReturn<T> extends UseApiState<T> {
  /** Re-fetch the data */
  refetch: () => Promise<void>;
}

export interface UseMutationReturn<TData, TArgs extends unknown[]> {
  data: TData | null;
  isLoading: boolean;
  error: Error | null;
  /** Execute the mutation */
  mutate: (...args: TArgs) => Promise<TData | null>;
  /** Reset state to idle */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// useApi — fetch data on mount (and on dependency change)
// ---------------------------------------------------------------------------

/**
 * Hook for GET-style API calls that fetch data on mount.
 * Automatically handles loading state, errors, and refetching.
 *
 * @param fetcher - Async function that returns ApiResponse<T>
 * @param deps - Dependency array to trigger re-fetch (like useEffect deps)
 */
export function useApi<T>(
  fetcher: () => Promise<ApiResponse<T>>,
  deps: unknown[] = []
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetcher();
      if (mountedRef.current) {
        setState({ data: response.data, isLoading: false, error: null });
      }
    } catch (err) {
      if (mountedRef.current) {
        setState({
          data: null,
          isLoading: false,
          error: err instanceof Error ? err : new Error("Unknown error"),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
  };
}

// ---------------------------------------------------------------------------
// useMutation — for POST/PUT/PATCH/DELETE calls triggered by user action
// ---------------------------------------------------------------------------

/**
 * Hook for mutation-style API calls (POST, PUT, PATCH, DELETE).
 * Does NOT fire on mount — call `mutate()` to execute.
 *
 * @param mutationFn - Async function that performs the mutation
 */
export function useMutation<TData, TArgs extends unknown[]>(
  mutationFn: (...args: TArgs) => Promise<ApiResponse<TData>>
): UseMutationReturn<TData, TArgs> {
  const [state, setState] = useState<UseApiState<TData>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutate = useCallback(
    async (...args: TArgs): Promise<TData | null> => {
      setState({ data: null, isLoading: true, error: null });
      try {
        const response = await mutationFn(...args);
        if (mountedRef.current) {
          setState({ data: response.data, isLoading: false, error: null });
        }
        return response.data;
      } catch (err) {
        if (mountedRef.current) {
          setState({
            data: null,
            isLoading: false,
            error: err instanceof Error ? err : new Error("Unknown error"),
          });
        }
        return null;
      }
    },
    // mutationFn is expected to be stable (defined outside component or wrapped in useCallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutationFn]
  );

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}
