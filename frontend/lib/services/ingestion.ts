"use client";

import { api } from "./api-client";
import type { ApiResponse } from "./api-client";

// ---------------------------------------------------------------------------
// Types (mirrors backend Pydantic schemas)
// ---------------------------------------------------------------------------

export interface FileMetadata {
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface AcceptedFile {
  filename: string;
  upload_url: string;
  candidate_id: string;
}

export interface RejectedFile {
  filename: string;
  reason: string;
}

export interface ResumeUploadResponse {
  accepted: AcceptedFile[];
  rejected: RejectedFile[];
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Validate resume files and get signed upload URLs.
 * Supports partial success: valid files are processed even if some are invalid.
 * Max 50 files per batch.
 */
export function uploadResumes(
  projectId: string,
  files: FileMetadata[]
): Promise<ApiResponse<ResumeUploadResponse>> {
  return api.post<ResumeUploadResponse>(
    `/api/v1/projects/${projectId}/resumes`,
    { files }
  );
}
