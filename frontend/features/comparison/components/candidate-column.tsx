"use client";

import { cn } from "@/lib/utils";
import type { ComparisonCandidate } from "./types";

interface CandidateColumnProps {
  candidate: ComparisonCandidate;
}

function getScoreColor(score: number): string {
  if (score >= 95) return "text-emerald-600";
  if (score >= 80) return "text-blue-600";
  if (score >= 65) return "text-amber-600";
  return "text-gray-500";
}

function getScoreRingColor(score: number): string {
  if (score >= 95) return "stroke-emerald-500";
  if (score >= 80) return "stroke-blue-500";
  if (score >= 65) return "stroke-amber-500";
  return "stroke-gray-400";
}

export function CandidateColumn({ candidate }: CandidateColumnProps) {
  const circumference = 2 * Math.PI * 20;
  const progress = (candidate.matchScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center rounded-[12px] border border-border bg-white p-4">
      {/* Avatar placeholder */}
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold">
        {candidate.fullName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)}
      </div>

      {/* Name */}
      <h3 className="mt-2 text-sm font-semibold text-navy text-center line-clamp-1">
        {candidate.fullName}
      </h3>

      {/* Company / Location */}
      <p className="mt-0.5 text-xs text-muted-foreground text-center line-clamp-1">
        {candidate.currentCompany ?? "—"}
      </p>
      <p className="text-xs text-muted-foreground text-center line-clamp-1">
        {candidate.location ?? "—"}
      </p>

      {/* Match score circle */}
      <div className="relative mt-3 flex items-center justify-center">
        <svg
          className="h-14 w-14 -rotate-90"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            className="stroke-gray-100"
            strokeWidth="4"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            className={cn(getScoreRingColor(candidate.matchScore))}
            strokeWidth="4"
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <span
          className={cn(
            "absolute text-sm font-bold",
            getScoreColor(candidate.matchScore)
          )}
        >
          {candidate.matchScore}
        </span>
      </div>

      {/* Confidence badge */}
      <span
        className={cn(
          "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          candidate.confidenceLevel === "High" &&
            "bg-emerald-50 text-emerald-700",
          candidate.confidenceLevel === "Medium" &&
            "bg-amber-50 text-amber-700",
          candidate.confidenceLevel === "Low" && "bg-gray-100 text-gray-600"
        )}
      >
        {candidate.confidenceLevel} confidence
      </span>
    </div>
  );
}
