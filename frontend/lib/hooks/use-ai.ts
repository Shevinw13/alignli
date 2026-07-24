"use client";

import { useCallback } from "react";
import { useApi, useMutation } from "./use-api";
import {
  extractJobDescription,
  generateCriteria,
  getProjectBrief,
} from "@/lib/services/ai";
import type {
  JDExtractionResponse,
  GenerateCriteriaResponse,
  BriefResponse,
} from "@/lib/services/ai";

/**
 * Hook to extract structured data from a job description.
 * Used in the project creation wizard JD step.
 */
export function useExtractJobDescription() {
  const mutationFn = useCallback(
    (projectId: string, text: string) =>
      extractJobDescription(projectId, text),
    []
  );
  return useMutation(mutationFn);
}

/**
 * Hook to generate ranking criteria from extracted JD.
 * Used in the project creation wizard criteria step.
 */
export function useGenerateCriteria() {
  const mutationFn = useCallback(
    (projectId: string, extractedJd: Record<string, unknown>) =>
      generateCriteria(projectId, extractedJd),
    []
  );
  return useMutation(mutationFn);
}

/**
 * Hook to fetch the AI Brief for a project (overview tab).
 */
export function useProjectBrief(projectId: string) {
  return useApi<BriefResponse>(
    () => getProjectBrief(projectId),
    [projectId]
  );
}
