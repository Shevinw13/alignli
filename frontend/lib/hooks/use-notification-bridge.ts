"use client";

import { useCallback } from "react";
import { useToast } from "@/components/shared/toast-provider";
import { useNotifications } from "@/components/shared/notification-center";
import type { SSEEvent } from "@/lib/types/api";

/**
 * Hook that bridges SSE events to the toast and notification systems.
 *
 * Use this in components that subscribe to SSE events to automatically
 * surface pipeline completions, failures, and other async updates
 * as both toasts (immediate feedback) and persistent notifications.
 *
 * @example
 * ```tsx
 * const { handleSSEEvent } = useNotificationBridge();
 *
 * useSSE({
 *   path: `/api/v1/projects/${projectId}/events`,
 *   onEvent: handleSSEEvent,
 * });
 * ```
 */
export function useNotificationBridge() {
  const toast = useToast();
  const { addNotification } = useNotifications();

  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      switch (event.type) {
        case "candidate.complete": {
          const data = event.data as { candidateName?: string; projectTitle?: string };
          const name = data.candidateName ?? "Candidate";
          toast.success(`${name} processing complete`);
          addNotification({
            type: "pipeline_complete",
            title: "Resume processed",
            message: `${name} has been scored and is ready for review.`,
            href: undefined,
          });
          break;
        }

        case "candidate.failed": {
          const data = event.data as { candidateName?: string; reason?: string };
          const name = data.candidateName ?? "Candidate";
          const reason = data.reason ?? "An unexpected error occurred";
          toast.error(`Failed to process ${name}`);
          addNotification({
            type: "pipeline_failed",
            title: "Processing failed",
            message: `${name}: ${reason}`,
          });
          break;
        }

        case "candidate.processing": {
          const data = event.data as { candidateName?: string; stage?: string };
          const name = data.candidateName ?? "Candidate";
          addNotification({
            type: "pipeline_processing",
            title: "Processing resume",
            message: `${name} — ${data.stage ?? "in progress"}`,
          });
          break;
        }

        case "project.ready": {
          const data = event.data as { projectTitle?: string };
          const title = data.projectTitle ?? "Hiring project";
          toast.success(`${title} is ready for review`, "Pipeline Complete");
          addNotification({
            type: "pipeline_complete",
            title: "All resumes processed",
            message: `${title} has been moved to Active. Candidates are ready for review.`,
          });
          break;
        }

        case "candidate.scored": {
          // Scored events are informational — add to notifications only
          const data = event.data as { candidateName?: string; score?: number };
          const name = data.candidateName ?? "Candidate";
          addNotification({
            type: "info",
            title: "Candidate scored",
            message: `${name} received a match score of ${data.score ?? "N/A"}.`,
          });
          break;
        }

        default:
          break;
      }
    },
    [toast, addNotification]
  );

  /**
   * Notify about email send results.
   * Call this from communication hooks after send completes or fails.
   */
  const notifyEmailSent = useCallback(
    (recipientName: string) => {
      toast.success(`Email sent to ${recipientName}`);
      addNotification({
        type: "email_sent",
        title: "Email sent",
        message: `Your email to ${recipientName} was delivered successfully.`,
      });
    },
    [toast, addNotification]
  );

  const notifyEmailFailed = useCallback(
    (recipientName: string, reason?: string) => {
      toast.error(`Failed to send email to ${recipientName}`);
      addNotification({
        type: "email_failed",
        title: "Email delivery failed",
        message: `Could not deliver email to ${recipientName}. ${reason ?? "Please try again."}`,
      });
    },
    [toast, addNotification]
  );

  /**
   * Notify about billing warnings (approaching limits).
   * Call this when usage data indicates ≥80% of a plan limit.
   */
  const notifyBillingWarning = useCallback(
    (metric: string, percentUsed: number) => {
      toast.warning(
        `${metric} is at ${percentUsed}% of your plan limit`,
        "Usage Warning"
      );
      addNotification({
        type: "billing_warning",
        title: `${metric} approaching limit`,
        message: `You've used ${percentUsed}% of your ${metric.toLowerCase()} allowance. Consider upgrading your plan.`,
      });
    },
    [toast, addNotification]
  );

  /**
   * Notify about billing limit reached (100% — actions blocked).
   */
  const notifyBillingLimitReached = useCallback(
    (metric: string) => {
      toast.error(
        `${metric} limit reached. Upgrade to continue.`,
        "Plan Limit Exceeded"
      );
      addNotification({
        type: "billing_limit_reached",
        title: `${metric} limit exceeded`,
        message: `You've reached your plan limit for ${metric.toLowerCase()}. New actions are blocked until you upgrade.`,
      });
    },
    [toast, addNotification]
  );

  return {
    handleSSEEvent,
    notifyEmailSent,
    notifyEmailFailed,
    notifyBillingWarning,
    notifyBillingLimitReached,
  };
}
