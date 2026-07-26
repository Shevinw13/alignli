"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { analyzeProjectCandidates } from "@/lib/services/candidates";

export interface ProcessingStepProps {
  projectId: string;
  totalResumes: number;
  sseEndpoint?: string;
}

/**
 * Processing step — calls the real AI analysis endpoint.
 * Shows progress while analyzing, then redirects to project page.
 */
export function ProcessingStep({ projectId }: ProcessingStepProps) {
  const [status, setStatus] = useState<"analyzing" | "done" | "error">("analyzing");
  const [errorMessage, setErrorMessage] = useState("");
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!projectId || hasStarted.current) return;
    hasStarted.current = true;

    async function runAnalysis() {
      try {
        await analyzeProjectCandidates(projectId);
        setStatus("done");
        // Redirect to the project page after a brief "done" flash
        setTimeout(() => {
          window.location.href = `/projects/${projectId}`;
        }, 800);
      } catch (err: unknown) {
        console.error("Analysis failed:", err);
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Analysis failed. Your candidates were saved — you can retry from the project page."
        );
        // Still redirect after a delay so they can see their project
        setTimeout(() => {
          window.location.href = `/projects/${projectId}`;
        }, 4000);
      }
    }

    runAnalysis();
  }, [projectId]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Pulsing logo mark */}
      <div className="relative mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/20">
          <img src="/narrowli.png" alt="" width={40} height={40} className="h-10 w-10 rounded-lg" />
        </div>
        {status === "analyzing" && (
          <div className="absolute -inset-2 rounded-2xl border-2 border-violet-400/30 animate-pulse" />
        )}
      </div>

      {/* Status text */}
      {status === "analyzing" && (
        <>
          <h2 className="text-lg font-semibold text-gray-900">
            Ranking your candidates...
          </h2>
          <p className="mt-2 text-sm text-gray-500 max-w-xs">
            Usually under 60 seconds
          </p>
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-violet-500" aria-hidden="true" />
        </>
      )}

      {status === "done" && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Done!
          </h2>
          <p className="mt-2 text-sm text-gray-500 max-w-xs">
            Redirecting to your results...
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Analysis issue
          </h2>
          <p className="mt-2 text-sm text-gray-500 max-w-xs">
            {errorMessage || "Something went wrong. Redirecting to your project..."}
          </p>
        </>
      )}
    </div>
  );
}
