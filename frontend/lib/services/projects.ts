"use client";

import { api } from "./api-client";
import type { ApiResponse } from "./api-client";

// ---------------------------------------------------------------------------
// Types (mirrors backend Pydantic schemas)
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  organization_id: string;
  title: string;
  location: string;
  employment_type: string;
  remote_preference: string;
  assigned_manager_id: string;
  state: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface CreateProjectRequest {
  title: string;
  location: string;
  employment_type: "Full-time" | "Part-time" | "Contract" | "Temporary";
  remote_preference: "Remote" | "Hybrid" | "On-site";
  assigned_manager_id: string;
}

export interface StateTransitionRequest {
  state: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * List hiring projects for the current organization.
 * Results are paginated and sorted by most recently updated.
 */
export function listProjects(
  page = 1,
  pageSize = 25
): Promise<ApiResponse<ProjectListResponse>> {
  return api.get<ProjectListResponse>(
    `/api/v1/projects?page=${page}&page_size=${pageSize}`
  );
}

/**
 * Get a single hiring project by ID.
 */
export function getProject(projectId: string): Promise<ApiResponse<Project>> {
  return api.get<Project>(`/api/v1/projects/${projectId}`);
}

/**
 * Create a new hiring project (starts in Draft state).
 */
export function createProject(
  data: CreateProjectRequest
): Promise<ApiResponse<Project>> {
  return api.post<Project>("/api/v1/projects", data);
}

/**
 * Transition a project to a new lifecycle state.
 */
export function transitionProjectState(
  projectId: string,
  state: string
): Promise<ApiResponse<Project>> {
  return api.patch<Project>(`/api/v1/projects/${projectId}/state`, { state });
}
