"use client";

import { api } from "./api-client";
import type { ApiResponse } from "./api-client";

// ---------------------------------------------------------------------------
// Types (mirrors backend Pydantic schemas)
// ---------------------------------------------------------------------------

export interface CriterionScoreResponse {
  criterion_id: string;
  raw_score: number;
  normalized_score: number;
  reasoning: string;
}

export interface ComparisonDimensions {
  experience: string | null;
  technical_skills: string | null;
  leadership: string | null;
  education: string | null;
  projects: string | null;
  career_growth: string | null;
  job_stability: string | null;
  industry_knowledge: string | null;
  communication: string | null;
}

export interface ComparedCandidate {
  id: string;
  full_name: string | null;
  match_score: number | null;
  criterion_scores: CriterionScoreResponse[];
  comparison_dimensions: ComparisonDimensions;
}

export interface CompareResponse {
  candidates: ComparedCandidate[];
}

export interface ComparisonSummaryResponse {
  summary: string;
  key_differentiators: string[];
  recommendation: string | null;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Compare 2-4 candidates side by side.
 * Returns aligned criterion scores and comparison dimensions.
 */
export function compareCandidates(
  candidateIds: string[]
): Promise<ApiResponse<CompareResponse>> {
  return api.post<CompareResponse>("/api/v1/candidates/compare", {
    candidate_ids: candidateIds,
  });
}

/**
 * Generate an AI-powered comparison summary for 2-4 candidates.
 */
export function generateComparisonSummary(
  candidateIds: string[]
): Promise<ApiResponse<ComparisonSummaryResponse>> {
  return api.post<ComparisonSummaryResponse>(
    "/api/v1/candidates/compare/summary",
    { candidate_ids: candidateIds }
  );
}
