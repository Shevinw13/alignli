"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { User, Eye, GitCompare, Mail } from "lucide-react";
import { ScoreIndicator } from "./score-indicator";

// --- Types ---

export type ConfidenceLevel = "High" | "Medium" | "Low";

export interface CandidateCardData {
  id: string;
  name: string;
  currentCompany: string | null;
  location: string | null;
  yearsExperience: number | null;
  matchScore: number | null;
  confidenceLevel: ConfidenceLevel | null;
  summary: string | null;
}

// --- Confidence Badge ---

const confidenceConfig: Record<ConfidenceLevel, { className: string }> = {
  High: { className: "bg-emerald-50 text-emerald-700" },
  Medium: { className: "bg-amber-50 text-amber-700" },
  Low: { className: "bg-gray-100 text-gray-600" },
};

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const config = confidenceConfig[level];
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {level} confidence
    </span>
  );
}

// --- Candidate Card Component ---

interface CandidateCardProps {
  candidate: CandidateCardData;
}

/**
 * Individual candidate card displaying ranked candidate info.
 *
 * Layout:
 * - Left: Avatar placeholder (gray circle with initials)
 * - Middle: Name (bold), company, location, years experience, 150-char summary snippet
 * - Right: Circular score indicator (percentage inside circle), confidence badge, action buttons
 *
 * Requirements: 10.2, 10.3, 10.4
 */
export function CandidateCard({ candidate }: CandidateCardProps) {
  // Truncate summary to 150 chars max
  const truncatedSummary = candidate.summary
    ? candidate.summary.length > 150
      ? candidate.summary.slice(0, 147) + "..."
      : candidate.summary
    : null;

  // Extract initials for avatar placeholder
  const initials = candidate.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article
      className="rounded-[16px] border border-border bg-white p-5 transition-shadow hover:shadow-sm"
      aria-label={`Candidate: ${candidate.name}`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar placeholder with initials */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-200"
          aria-hidden="true"
        >
          <span className="text-sm font-medium text-gray-600">{initials}</span>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-navy truncate">
                {candidate.name}
              </h4>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {candidate.currentCompany && (
                  <span>{candidate.currentCompany}</span>
                )}
                {candidate.location && <span>{candidate.location}</span>}
                {candidate.yearsExperience !== null && (
                  <span>{candidate.yearsExperience} yrs exp</span>
                )}
              </div>
            </div>

            {/* Score indicator */}
            {candidate.matchScore !== null && (
              <ScoreIndicator score={candidate.matchScore} />
            )}
          </div>

          {/* Summary snippet */}
          {truncatedSummary && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {truncatedSummary}
            </p>
          )}

          {/* Footer: confidence + actions */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {candidate.confidenceLevel && (
              <ConfidenceBadge level={candidate.confidenceLevel} />
            )}

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 rounded-[8px] px-2 text-xs text-muted-foreground hover:text-indigo-600"
                aria-label={`View profile for ${candidate.name}`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                View Profile
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 rounded-[8px] px-2 text-xs text-muted-foreground hover:text-indigo-600"
                aria-label={`Compare ${candidate.name}`}
              >
                <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
                Compare
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 rounded-[8px] px-2 text-xs text-muted-foreground hover:text-indigo-600"
                aria-label={`Email ${candidate.name}`}
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Email
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
