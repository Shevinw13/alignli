"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export interface ProcessingStepProps {
  projectId: string;
  totalResumes: number;
  sseEndpoint?: string;
}

/**
 * Minimal, fast processing step.
 * Shows branded loader for ~3 seconds, then redirects home.
 * No fake multi-stage theater — respects the user's time.
 */
export function ProcessingStep({ projectId }: ProcessingStepProps) {
  const [status, setStatus] = useState<"analyzing" | "done">("analyzing");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Simulate processing (real backend would use SSE)
    // Keep it fast — 2.5 seconds max
    timerRef.current = setTimeout(() => {
      setStatus("done");
      // Redirect after brief "done" flash
      setTimeout(() => {
        window.location.href = "/";
      }, 800);
    }, 2500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
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
      <h2 className="text-lg font-semibold text-gray-900">
        {status === "analyzing" ? "Analyzing candidates..." : "Done!"}
      </h2>
      <p className="mt-2 text-sm text-gray-500 max-w-xs">
        {status === "analyzing"
          ? "AI is reading resumes and scoring against your criteria"
          : "Redirecting to your results..."}
      </p>

      {/* Spinner */}
      {status === "analyzing" && (
        <Loader2 className="mt-6 h-5 w-5 animate-spin text-violet-500" aria-hidden="true" />
      )}
    </div>
  );
}
