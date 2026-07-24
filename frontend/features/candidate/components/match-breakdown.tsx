"use client";

import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard } from "./section-card";

interface CriterionScore {
  criteriaLabel: string;
  category: string;
  rawScore: number;
  maxScore: number;
  reasoning: string;
}

interface MatchBreakdownProps {
  scores: CriterionScore[];
  error?: boolean;
  onRetry?: () => void;
}

function getScoreColor(percent: number): string {
  if (percent >= 95) return "bg-emerald-500";
  if (percent >= 80) return "bg-blue-500";
  if (percent >= 65) return "bg-amber-500";
  return "bg-gray-400";
}

function getScoreTextColor(percent: number): string {
  if (percent >= 95) return "text-emerald-700";
  if (percent >= 80) return "text-blue-700";
  if (percent >= 65) return "text-amber-700";
  return "text-gray-600";
}

/**
 * Match Breakdown section — per-criterion scores with progress bars
 * and AI reasoning for each score.
 *
 * Requirement 11.3
 */
export function MatchBreakdown({
  scores,
  error = false,
  onRetry,
}: MatchBreakdownProps) {
  return (
    <SectionCard
      title="Match Breakdown"
      icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />}
      error={error}
      onRetry={onRetry}
    >
      {scores.length > 0 ? (
        <div className="space-y-4">
          {scores.map((score, idx) => {
            const percent = score.maxScore > 0
              ? Math.round((score.rawScore / score.maxScore) * 100)
              : 0;
            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-navy">
                      {score.criteriaLabel}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-muted-foreground">
                      {score.category}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      getScoreTextColor(percent)
                    )}
                  >
                    {score.rawScore}/{score.maxScore}
                  </span>
                </div>
                {/* Progress bar */}
                <div
                  className="h-2 w-full rounded-full bg-gray-100"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${score.criteriaLabel}: ${percent}%`}
                >
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all",
                      getScoreColor(percent)
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                {/* Reasoning */}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {score.reasoning}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          No scoring data available yet.
        </p>
      )}
    </SectionCard>
  );
}
