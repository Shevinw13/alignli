"use client";

import { useCallback } from "react";
import { useApi, useMutation } from "./use-api";
import {
  listCandidates,
  getCandidateProfile,
  hireCandidate,
} from "@/lib/services/candidates";
import type {
  CandidateListResponse,
  CandidateProfile,
  CandidateListParams,
  HireCandidateResponse,
} from "@/lib/services/candidates";

/**
 * Hook to fetch candidates for a project (candidates tab).
 * Supports pagination and filtering by score/confidence.
 */
export function useCandidates(projectId: string, params: CandidateListParams = {}) {
  const { page, pageSize, minScore, maxScore, confidence } = params;
  return useApi<CandidateListResponse>(
    () => listCandidates(projectId, params),
    [projectId, page, pageSize, minScore, maxScore, confidence]
  );
}

/**
 * Hook to fetch a full candidate profile (candidate detail page).
 */
export function useCandidateProfile(candidateId: string) {
  return useApi<CandidateProfile>(
    () => getCandidateProfile(candidateId),
    [candidateId]
  );
}

/**
 * Hook to mark a candidate as hired.
 */
export function useHireCandidate() {
  const mutationFn = useCallback(
    (candidateId: string) => hireCandidate(candidateId),
    []
  );
  return useMutation(mutationFn);
}
