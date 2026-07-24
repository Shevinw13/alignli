"use client";

import { api } from "./api-client";
import type { ApiResponse } from "./api-client";

// ---------------------------------------------------------------------------
// Types (mirrors backend Pydantic schemas)
// ---------------------------------------------------------------------------

export interface CommunicationRecord {
  id: string;
  candidate_id: string;
  sender_id: string;
  recipient_email: string;
  subject: string;
  body: string;
  delivery_status: string;
  sent_at: string | null;
  created_at: string;
}

export interface CommunicationListResponse {
  items: CommunicationRecord[];
}

export interface SendEmailRequest {
  candidate_id: string;
  hiring_project_id: string;
  subject: string;
  body: string;
}

export interface SendEmailResponse {
  communication: CommunicationRecord;
  message: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Send an email to a candidate.
 * On failure, the communication record is still stored with delivery_status="failed".
 */
export function sendEmail(
  data: SendEmailRequest
): Promise<ApiResponse<SendEmailResponse>> {
  return api.post<SendEmailResponse>("/api/v1/communication/send", data);
}

/**
 * Get email history for a hiring project, ordered by most recent first.
 */
export function getCommunicationHistory(
  projectId: string
): Promise<ApiResponse<CommunicationListResponse>> {
  return api.get<CommunicationListResponse>(
    `/api/v1/communication/${projectId}`
  );
}
