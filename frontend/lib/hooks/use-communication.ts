"use client";

import { useCallback } from "react";
import { useApi, useMutation } from "./use-api";
import {
  sendEmail,
  getCommunicationHistory,
} from "@/lib/services/communication";
import type {
  CommunicationListResponse,
  SendEmailRequest,
  SendEmailResponse,
} from "@/lib/services/communication";

/**
 * Hook to fetch email history for a project (communication tab).
 */
export function useCommunicationHistory(projectId: string) {
  return useApi<CommunicationListResponse>(
    () => getCommunicationHistory(projectId),
    [projectId]
  );
}

/**
 * Hook to send an email to a candidate.
 */
export function useSendEmail() {
  const mutationFn = useCallback(
    (data: SendEmailRequest) => sendEmail(data),
    []
  );
  return useMutation(mutationFn);
}
