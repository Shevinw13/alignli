"use client";

import { api } from "./api-client";
import type { ApiResponse } from "./api-client";

// ---------------------------------------------------------------------------
// Types (mirrors backend Pydantic schemas)
// ---------------------------------------------------------------------------

export type ConfidenceLevel = "High" | "Medium" | "Low";

export interface CandidateCard {
  id: string;
  full_name: string | null;
  current_company: string | null;
  location: string | null;
  years_experience: number | null;
  match_score: number | null;
  confidence_level: string | null;
  summary: string | null;
  processing_status: string;
}

export interface CandidateListResponse {
  items: CandidateCard[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface CandidateProfile {
  id: string;
  hiring_project_id: string;
  organization_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  website_url: string | null;
  current_company: string | null;
  location: string | null;
  years_experience: number | null;
  match_score: number | null;
  confidence_level: string | null;
  processing_status: string;
  status: string;
  parsed_data: Record<string, unknown> | null;
  summary: string | null;
  strengths: unknown[] | null;
  concerns: unknown[] | null;
  interview_questions: unknown[] | null;
  created_at: string;
  updated_at: string;
}

export interface HireCandidateResponse {
  candidate: CandidateProfile;
  project_fillable: boolean;
}

export interface CandidateListParams {
  page?: number;
  pageSize?: number;
  minScore?: number;
  maxScore?: number;
  confidence?: ConfidenceLevel;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * List candidates for a hiring project, sorted by Match_Score descending.
 * Supports pagination and filtering by score range / confidence level.
 */
export function listCandidates(
  projectId: string,
  params: CandidateListParams = {}
): Promise<ApiResponse<CandidateListResponse>> {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page ?? 1));
  searchParams.set("page_size", String(params.pageSize ?? 25));
  if (params.minScore != null) searchParams.set("min_score", String(params.minScore));
  if (params.maxScore != null) searchParams.set("max_score", String(params.maxScore));
  if (params.confidence) searchParams.set("confidence", params.confidence);

  return api.get<CandidateListResponse>(
    `/api/v1/projects/${projectId}/candidates?${searchParams.toString()}`
  );
}

/**
 * Get a full candidate profile by ID.
 */
export function getCandidateProfile(
  candidateId: string
): Promise<ApiResponse<CandidateProfile>> {
  return api.get<CandidateProfile>(`/api/v1/candidates/${candidateId}`);
}

/**
 * Mark a candidate as hired.
 * Returns the updated candidate and whether the project can be filled.
 */
export function hireCandidate(
  candidateId: string
): Promise<ApiResponse<HireCandidateResponse>> {
  return api.post<HireCandidateResponse>(
    `/api/v1/candidates/${candidateId}/hire`
  );
}
