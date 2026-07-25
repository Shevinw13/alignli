"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye, Star, MoreHorizontal, Bookmark, Info } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

// --- Types ---

export type ConfidenceLevel = "High" | "Medium" | "Low";

export interface EvaluationEvidence {
  category: string;
  tags: string[];
}

export interface CandidateCardData {
  id: string;
  name: string;
  currentCompany: string | null;
  currentRole?: string | null;
  location: string | null;
  yearsExperience: number | null;
  matchScore: number | null;
  confidenceLevel: ConfidenceLevel | null;
  summary: string | null;
  skills?: string[];
  industry?: string | null;
  evaluationEvidence?: EvaluationEvidence[];
}

// --- Skill Tag Colors (rotate through a set) ---

const SKILL_COLORS = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-purple-50 text-purple-700 border-purple-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-cyan-50 text-cyan-700 border-cyan-200",
];

const INDUSTRY_COLORS: Record<string, string> = {
  Fintech: "bg-emerald-100 text-emerald-800",
  Healthcare: "bg-blue-100 text-blue-800",
  Technology: "bg-purple-100 text-purple-800",
  Education: "bg-amber-100 text-amber-800",
  Finance: "bg-emerald-100 text-emerald-800",
  Retail: "bg-rose-100 text-rose-800",
};

// --- Match Score Color ---

function getMatchColor(score: number): string {
  if (score >= 90) return "text-emerald-600";
  if (score >= 75) return "text-blue-600";
  if (score >= 60) return "text-amber-600";
  return "text-gray-500";
}

// --- Component ---

interface CandidateCardProps {
  candidate: CandidateCardData;
  onShortlist?: (candidateId: string) => void;
  isShortlisted?: boolean;
}

export function CandidateCard({ candidate, onShortlist, isShortlisted = false }: CandidateCardProps) {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? "1";
  const [showReasoning, setShowReasoning] = useState(false);

  const initials = candidate.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const skills = candidate.skills ?? [];
  const industry = candidate.industry;

  return (
    <article
      className="hover-elevate rounded-lg border border-border bg-white px-5 py-4"
      aria-label={`Candidate: ${candidate.name}`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500"
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Top row: name + industry + match score */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-navy truncate">
                  {candidate.name}
                </h4>
                {industry && (
                  <span className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    INDUSTRY_COLORS[industry] ?? "bg-gray-100 text-gray-700"
                  )}>
                    {industry}
                  </span>
                )}
              </div>
              {/* Role + Company */}
              <p className="mt-0.5 text-sm text-muted-foreground truncate">
                {candidate.currentRole ?? ""}
                {candidate.currentRole && candidate.currentCompany && " at "}
                {candidate.currentCompany ?? ""}
              </p>
              {/* Location + Years */}
              <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                {candidate.location && <span>📍 {candidate.location}</span>}
                {candidate.yearsExperience !== null && (
                  <span>🕐 {candidate.yearsExperience} years</span>
                )}
              </div>
            </div>

            {/* Match Score */}
            {candidate.matchScore !== null && (
              <div className="shrink-0 text-right">
                <span className={cn("text-lg font-bold", getMatchColor(candidate.matchScore))}>
                  {candidate.matchScore}% match
                </span>
              </div>
            )}
          </div>

          {/* Skill Tags */}
          {skills.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {skills.slice(0, 8).map((skill, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-block rounded-md border px-2 py-0.5 text-xs font-medium",
                    SKILL_COLORS[i % SKILL_COLORS.length]
                  )}
                >
                  {skill}
                </span>
              ))}
              {skills.length > 8 && (
                <span className="inline-block rounded-md bg-gray-50 px-2 py-0.5 text-xs text-muted-foreground">
                  +{skills.length - 8} more
                </span>
              )}
            </div>
          )}

          {/* Actions row */}
          <div className="mt-3 flex items-center justify-between">
            {/* Left: Why this score */}
            <button
              type="button"
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-navy interactive"
              aria-expanded={showReasoning}
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              Why this score?
            </button>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 gap-1 rounded-md px-2 text-xs",
                  isShortlisted
                    ? "text-amber-600 bg-amber-50"
                    : "text-muted-foreground hover:text-amber-600"
                )}
                onClick={() => onShortlist?.(candidate.id)}
                aria-label={isShortlisted ? `Remove ${candidate.name} from shortlist` : `Add ${candidate.name} to shortlist`}
              >
                <Bookmark className={cn("h-3.5 w-3.5", isShortlisted && "fill-current")} aria-hidden="true" />
                {isShortlisted ? "Shortlisted" : "Shortlist"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-navy"
                aria-label={`View profile for ${candidate.name}`}
                render={<Link href={`/projects/${projectId}/candidates/${candidate.id}`} />}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                View
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 rounded-md px-0 text-muted-foreground hover:text-navy"
                aria-label={`More actions for ${candidate.name}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {/* Expandable: Why this score (bias transparency) */}
          {showReasoning && (
            <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-muted-foreground space-y-2 animate-in-up">
              <p className="font-medium text-navy">Score breakdown</p>
              {candidate.evaluationEvidence && candidate.evaluationEvidence.length > 0 ? (
                <ul className="space-y-1">
                  {candidate.evaluationEvidence.map((ev, i) => (
                    <li key={i}>
                      <span className="font-medium">{ev.category}:</span>{" "}
                      {ev.tags.join(", ")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Scored based on skills match, experience alignment, and criteria priority weighting.</p>
              )}
              <p className="pt-1 border-t border-gray-200 text-[11px] text-muted-foreground/70 italic">
                This evaluation is based solely on the role criteria you defined. No demographic data was considered.
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
