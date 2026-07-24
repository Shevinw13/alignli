"use client";

import { useCallback } from "react";
import { useMutation } from "./use-api";
import {
  compareCandidates,
  generateComparisonSummary,
} from "@/lib/services/comparison";
import type {
  CompareResponse,
  ComparisonSummaryResponse,
} from "@/lib/services/comparison";

/**
 * Hook to compare 2-4 candidates side by side.
 * Triggered on demand (when user selects candidates and confirms).
 */
export function useCompareCandidates() {
  const mutationFn = useCallback(
    (candidateIds: string[]) => compareCandidates(candidateIds),
    []
  );
  return useMutation(mutationFn);
}

/**
 * Hook to generate an AI comparison summary for selected candidates.
 */
export function useComparisonSummary() {
  const mutationFn = useCallback(
    (candidateIds: string[]) => generateComparisonSummary(candidateIds),
    []
  );
  return useMutation(mutationFn);
}
