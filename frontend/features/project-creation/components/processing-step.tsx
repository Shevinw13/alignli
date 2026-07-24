"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Circle, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---

type StageStatus = "pending" | "active" | "complete" | "failed";

interface ProcessingStage {
  id: string;
  label: string;
  status: StageStatus;
  completed: number;
  total: number;
}

export interface ProcessingStepProps {
  /** The project ID being processed */
  projectId: string;
  /** Total number of resumes to process */
  totalResumes: number;
  /** Optional SSE endpoint override (for testing) */
  sseEndpoint?: string;
}

// --- Constants ---

const STAGES: { id: string; label: string }[] = [
  { id: "reading", label: "Reading resumes" },
  { id: "extracting", label: "Extracting information" },
  { id: "comparing", label: "Comparing against criteria" },
  { id: "ranking", label: "Ranking candidates" },
  { id: "generating", label: "Generating summaries" },
];

const AUTO_NAVIGATE_DELAY_MS = 3000;

// --- Component ---

export function ProcessingStep({
  projectId,
  totalResumes,
  sseEndpoint,
}: ProcessingStepProps) {
  const router = useRouter();
  const [stages, setStages] = useState<ProcessingStage[]>(
    STAGES.map((s) => ({
      ...s,
      status: "pending" as StageStatus,
      completed: 0,
      total: totalResumes,
    }))
  );
  const [allComplete, setAllComplete] = useState(false);
  const [allFailed, setAllFailed] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);

  // Determine if all stages are complete
  const checkCompletion = useCallback((updatedStages: ProcessingStage[]) => {
    const allDone = updatedStages.every(
      (s) => s.status === "complete" || s.status === "failed"
    );
    if (!allDone) return;

    const allStageFailed = updatedStages.every((s) => s.status === "failed");
    if (allStageFailed) {
      setAllFailed(true);
      return;
    }

    // Check if all resumes failed (all completed counts are 0 or all stages that processed have 0 success)
    const firstStage = updatedStages[0];
    if (firstStage.completed === 0 && firstStage.status === "complete") {
      // This means no resumes were successfully processed
      setAllFailed(true);
      return;
    }

    setAllComplete(true);
  }, []);

  // SSE subscription for real-time progress
  useEffect(() => {
    mountedRef.current = true;
    const endpoint =
      sseEndpoint ?? `/api/v1/projects/${projectId}/events`;

    // For now, use mock SSE simulation since backend SSE isn't connected yet
    // In production, this would be: new EventSource(endpoint)
    const mockSimulation = simulateMockProgress(totalResumes, (update) => {
      if (!mountedRef.current) return;

      setStages((prev) => {
        const updated = prev.map((stage) => {
          if (stage.id === update.stageId) {
            return {
              ...stage,
              status: update.status,
              completed: update.completed,
              total: update.total,
            };
          }
          return stage;
        });
        // Check completion after update
        setTimeout(() => checkCompletion(updated), 0);
        return updated;
      });
    });

    return () => {
      mountedRef.current = false;
      mockSimulation.cancel();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [projectId, totalResumes, sseEndpoint, checkCompletion]);

  // Auto-navigate after completion
  useEffect(() => {
    if (allComplete && !navigating) {
      setNavigating(true);
      navigateTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          router.push(`/projects/${projectId}`);
        }
      }, AUTO_NAVIGATE_DELAY_MS);
    }

    return () => {
      if (navigateTimerRef.current) {
        clearTimeout(navigateTimerRef.current);
      }
    };
  }, [allComplete, navigating, projectId, router]);

  // --- Render ---

  if (allFailed) {
    return (
      <div className="flex flex-col items-center gap-4 py-12" role="alert">
        <AlertTriangle className="h-12 w-12 text-red-500" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-navy">Processing Failed</h2>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          All resumes failed processing. The project will remain in Draft state.
          Please check the resume files and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-navy">
          Processing Resumes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {allComplete
            ? "All resumes have been processed successfully."
            : "The AI is analyzing your resumes. This may take a moment."}
        </p>
      </div>

      {/* Stage list */}
      <ul
        className="flex flex-col gap-3"
        role="list"
        aria-label="Processing stages"
      >
        {stages.map((stage) => (
          <li
            key={stage.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
              stage.status === "active" && "border-indigo-200 bg-indigo-50/50",
              stage.status === "complete" && "border-emerald-200 bg-emerald-50/30",
              stage.status === "failed" && "border-red-200 bg-red-50/30",
              stage.status === "pending" && "border-border bg-white"
            )}
          >
            {/* Status icon */}
            <div className="shrink-0">
              <StageIcon status={stage.status} />
            </div>

            {/* Label and progress */}
            <div className="flex-1">
              <span
                className={cn(
                  "text-sm font-medium",
                  stage.status === "active" && "text-indigo-700",
                  stage.status === "complete" && "text-emerald-700",
                  stage.status === "failed" && "text-red-700",
                  stage.status === "pending" && "text-muted-foreground"
                )}
              >
                {stage.label}
              </span>
            </div>

            {/* Progress counter */}
            <div className="shrink-0">
              <span
                className={cn(
                  "text-xs tabular-nums",
                  stage.status === "active" && "text-indigo-600",
                  stage.status === "complete" && "text-emerald-600",
                  stage.status === "failed" && "text-red-600",
                  stage.status === "pending" && "text-muted-foreground"
                )}
                aria-label={`${stage.completed} of ${stage.total} resumes processed`}
              >
                {stage.status !== "pending"
                  ? `${stage.completed} of ${stage.total}`
                  : "—"}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* Completion message with countdown */}
      {allComplete && (
        <div
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2
            className="h-5 w-5 text-emerald-600"
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-emerald-700">
            Processing complete! Redirecting to project page…
          </span>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function StageIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case "pending":
      return (
        <Circle
          className="h-5 w-5 text-gray-300"
          aria-label="Pending"
        />
      );
    case "active":
      return (
        <Loader2
          className="h-5 w-5 animate-spin text-indigo-600"
          aria-label="In progress"
        />
      );
    case "complete":
      return (
        <CheckCircle2
          className="h-5 w-5 text-emerald-500"
          aria-label="Complete"
        />
      );
    case "failed":
      return (
        <XCircle
          className="h-5 w-5 text-red-500"
          aria-label="Failed"
        />
      );
  }
}

// --- Mock SSE simulation ---

interface MockProgressUpdate {
  stageId: string;
  status: StageStatus;
  completed: number;
  total: number;
}

function simulateMockProgress(
  totalResumes: number,
  onUpdate: (update: MockProgressUpdate) => void
) {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];

  const stageIds = STAGES.map((s) => s.id);
  let delay = 0;

  for (let stageIndex = 0; stageIndex < stageIds.length; stageIndex++) {
    const stageId = stageIds[stageIndex];

    // Mark stage as active
    delay += 500;
    const activateTimer = setTimeout(() => {
      if (cancelled) return;
      onUpdate({
        stageId,
        status: "active",
        completed: 0,
        total: totalResumes,
      });
    }, delay);
    timers.push(activateTimer);

    // Simulate incremental progress
    for (let i = 1; i <= totalResumes; i++) {
      delay += 300 + Math.random() * 400;
      const progressTimer = setTimeout(() => {
        if (cancelled) return;
        onUpdate({
          stageId,
          status: "active",
          completed: i,
          total: totalResumes,
        });
      }, delay);
      timers.push(progressTimer);
    }

    // Mark stage as complete
    delay += 200;
    const completeTimer = setTimeout(() => {
      if (cancelled) return;
      onUpdate({
        stageId,
        status: "complete",
        completed: totalResumes,
        total: totalResumes,
      });
    }, delay);
    timers.push(completeTimer);
  }

  return {
    cancel: () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    },
  };
}
