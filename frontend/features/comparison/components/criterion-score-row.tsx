"use client";

import { cn } from "@/lib/utils";
import type { ComparisonCandidate, CriterionScore } from "./types";

interface CriterionScoreRowProps {
  criterionLabel: string;
  criterionCategory: string;
  candidates: ComparisonCandidate[];
  criterionId: string;
}

function getScoreBarColor(score: number, maxScore: number): string {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 90) return "bg-emerald-500";
  if (pct >= 70) return "bg-blue-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-gray-400";
}

export function CriterionScoreRow({
  criterionLabel,
  criterionCategory,
  candidates,
  criterionId,
}: CriterionScoreRowProps) {
  return (
    <div className="grid items-center gap-3 border-b border-border py-3 last:border-b-0"
      style={{ gridTemplateColumns: `180px repeat(${candidates.length}, 1fr)` }}
    >
      {/* Label column */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy truncate">{criterionLabel}</p>
        <p className="text-xs text-muted-foreground">{criterionCategory}</p>
      </div>

      {/* Score columns */}
      {candidates.map((candidate) => {
        const score = candidate.criterionScores.find(
          (s) => s.criterionId === criterionId
        );

        if (!score) {
          return (
            <div key={candidate.id} className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground italic">
                No data
              </span>
            </div>
          );
        }

        const percentage =
          score.maxScore > 0 ? (score.rawScore / score.maxScore) * 100 : 0;

        return (
          <div key={candidate.id} className="flex flex-col items-center gap-1">
            <span className="text-sm font-semibold text-navy">
              {score.rawScore}/{score.maxScore}
            </span>
            <div className="h-2 w-full max-w-[80px] rounded-full bg-gray-100">
              <div
                className={cn(
                  "h-2 rounded-full transition-all",
                  getScoreBarColor(score.rawScore, score.maxScore)
                )}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
