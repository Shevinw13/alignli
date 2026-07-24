"use client";

import { api } from "./api-client";
import type { ApiResponse } from "./api-client";

// ---------------------------------------------------------------------------
// Types (mirrors backend Pydantic schemas)
// ---------------------------------------------------------------------------

export interface JDExtractionRequest {
  text: string;
  file_url?: string;
}

export interface ExtractedCategory {
  category: string;
  items: string[];
}

export interface JDExtractionResponse {
  categories: ExtractedCategory[];
  raw_text_length: number;
}

export interface RankingCriterion {
  category: string;
  label: string;
  priority: "Low" | "Medium" | "High";
  max_score: number;
}

export interface GenerateCriteriaResponse {
  criteria: RankingCriterion[];
}

export interface ScoreDistribution {
  range: string;
  count: number;
}

export interface TopCandidate {
  id: string;
  full_name: string | null;
  match_score: number | null;
}

export interface BriefResponse {
  total_candidates: number;
  score_distribution: ScoreDistribution[];
  top_candidates: TopCandidate[];
  patterns: string[];
  recommended_action: string | null;
  summary: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Extract structured data from a job description text.
 * Returns categorized requirements for user review.
 */
export function extractJobDescription(
  projectId: string,
  text: string
): Promise<ApiResponse<JDExtractionResponse>> {
  return api.post<JDExtractionResponse>(
    `/api/v1/projects/${projectId}/extract-jd`,
    { text }
  );
}

/**
 * Generate AI-suggested ranking criteria from extracted JD data.
 * Each criterion includes category, label, priority, and max_score.
 */
export function generateCriteria(
  projectId: string,
  extractedJd: Record<string, unknown>
): Promise<ApiResponse<GenerateCriteriaResponse>> {
  return api.post<GenerateCriteriaResponse>(
    `/api/v1/projects/${projectId}/generate-criteria`,
    { extracted_jd: extractedJd }
  );
}

/**
 * Get the AI Brief for a hiring project.
 * Includes score distribution, top candidates, patterns, and summary.
 */
export function getProjectBrief(
  projectId: string
): Promise<ApiResponse<BriefResponse>> {
  return api.get<BriefResponse>(`/api/v1/projects/${projectId}/brief`);
}
