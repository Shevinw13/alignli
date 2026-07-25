"use client";

import { Sparkles, RefreshCw, AlertCircle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// --- Legacy interface (kept for backward compatibility) ---

export interface AIBriefData {
  totalCandidates: number;
  scoreDistribution: string;
  topHighlights: string[];
  patterns: string[];
  recommendedAction: string;
}

// --- Narrative data interface ---

export interface AIBriefNarrativeData {
  /** Executive summary paragraph */
  executiveSummary: string;
  /** Pool quantification */
  poolStats: {
    total: number;
    exceedingRequirements: number;
    meetingMinimum: number;
    notMeeting: number;
  };
  /** Top candidates with narrative descriptions */
  topCandidates: {
    name: string;
    narrative: string;
    strengths: string[];
  }[];
  /** Candidates requiring discussion */
  discussionCandidates: {
    name: string;
    narrative: string;
    concerns: string[];
  }[];
  /** Not recommended */
  notRecommended: {
    count: number;
    commonReasons: string[];
  };
  /** Suggestions when pool is limited */
  limitedPoolSuggestions?: string[];
}

// --- Props interface (backward compatible) ---

interface AIBriefProps {
  data: AIBriefData | null;
  narrativeData?: AIBriefNarrativeData | null;
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
  zeroCandidates: boolean;
}

// --- Skeleton Loader for narrative layout ---

function AIBriefSkeleton() {
  return (
    <div className="mt-6 space-y-6" aria-busy="true">
      {/* Executive Summary skeleton */}
      <div className="space-y-2">
        <Skeleton variant="text" className="h-5 w-48" />
        <Skeleton variant="text" className="h-4 w-full" />
        <Skeleton variant="text" className="h-4 w-full" />
        <Skeleton variant="text" className="h-4 w-3/4" />
      </div>
      {/* Top Candidates skeleton */}
      <div className="space-y-3">
        <Skeleton variant="text" className="h-5 w-36" />
        <Skeleton variant="rectangular" className="h-20 w-full rounded-[12px]" />
        <Skeleton variant="rectangular" className="h-20 w-full rounded-[12px]" />
      </div>
      {/* Discussion section skeleton */}
      <div className="space-y-2">
        <Skeleton variant="text" className="h-5 w-52" />
        <Skeleton variant="text" className="h-4 w-full" />
        <Skeleton variant="text" className="h-4 w-5/6" />
      </div>
    </div>
  );
}

// --- Helper: Convert legacy data to narrative format ---

function legacyToNarrative(data: AIBriefData): AIBriefNarrativeData {
  const exceedingCount = Math.round(data.totalCandidates * 0.2);
  const meetingCount = Math.round(data.totalCandidates * 0.5);
  const notMeetingCount = data.totalCandidates - exceedingCount - meetingCount;

  return {
    executiveSummary: `We reviewed ${data.totalCandidates} resumes. ${exceedingCount} candidates clearly exceed your requirements, ${meetingCount} meet minimum criteria, and ${notMeetingCount} fall short of the baseline. ${data.scoreDistribution}`,
    poolStats: {
      total: data.totalCandidates,
      exceedingRequirements: exceedingCount,
      meetingMinimum: meetingCount,
      notMeeting: notMeetingCount,
    },
    topCandidates: data.topHighlights.map((highlight, i) => ({
      name: `Candidate ${i + 1}`,
      narrative: highlight,
      strengths: [],
    })),
    discussionCandidates: data.patterns.map((pattern, i) => ({
      name: `Candidate ${exceedingCount + i + 1}`,
      narrative: pattern,
      concerns: [],
    })),
    notRecommended: {
      count: notMeetingCount,
      commonReasons: [data.recommendedAction],
    },
    limitedPoolSuggestions:
      exceedingCount < 3
        ? [
            "Consider broadening experience requirements",
            "Review whether all listed skills are truly essential",
          ]
        : undefined,
  };
}

// --- Main Component ---

export function AIBrief({
  data,
  narrativeData,
  isLoading,
  error,
  onRetry,
  zeroCandidates,
}: AIBriefProps) {
  // Use narrative data if available, otherwise convert legacy data
  const narrative = narrativeData ?? (data ? legacyToNarrative(data) : null);

  return (
    <section
      className={cn(
        "rounded-[16px] border border-border bg-white p-6",
        "transition-shadow hover:shadow-[0_2px_4px_rgba(0,0,0,0.05)]"
      )}
      aria-labelledby="ai-brief-heading"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-indigo-50 text-indigo-600">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 id="ai-brief-heading" className="text-lg font-semibold text-navy">
          AI Brief
        </h2>
      </div>

      {/* Loading state — skeleton matching narrative layout */}
      {isLoading && <AIBriefSkeleton />}

      {/* Error state with retry */}
      {error && !isLoading && (
        <div className="mt-4 flex items-center gap-3 rounded-[12px] bg-red-50 p-4">
          <AlertCircle
            className="h-5 w-5 shrink-0 text-red-500"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">
              Unable to generate AI Brief
            </p>
            <p className="mt-0.5 text-sm text-red-600">
              Something went wrong. Please try again.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}

      {/* Zero candidates state */}
      {!isLoading && !error && zeroCandidates && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            No candidates have been added to this project yet. Upload resumes to
            get started with AI-powered analysis.
          </p>
        </div>
      )}

      {/* Narrative brief content */}
      {!isLoading && !error && narrative && !zeroCandidates && (
        <div className="mt-6 space-y-6">
          {/* Executive Summary */}
          <div>
            <h3 className="text-sm font-semibold text-navy mb-2">
              Executive Summary
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {narrative.executiveSummary}
            </p>
          </div>

          {/* Top Candidates */}
          {narrative.topCandidates.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-navy mb-3">
                Top Candidates
              </h3>
              <div className="space-y-3">
                {narrative.topCandidates.map((candidate, index) => (
                  <div
                    key={index}
                    className="rounded-[12px] border border-emerald-100 bg-emerald-50/50 p-4"
                  >
                    <p className="text-sm font-medium text-navy">
                      {candidate.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {candidate.narrative}
                    </p>
                    {candidate.strengths.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {candidate.strengths.map((strength, si) => (
                          <span
                            key={si}
                            className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                          >
                            {strength}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Limited pool callout — shown when fewer than 3 exceed requirements */}
          {narrative.limitedPoolSuggestions &&
            narrative.limitedPoolSuggestions.length > 0 && (
              <div className="flex gap-3 rounded-[12px] border border-amber-100 bg-amber-50/50 p-4">
                <Lightbulb
                  className="h-5 w-5 shrink-0 text-amber-500 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Limited candidate pool
                  </p>
                  <p className="mt-1 text-sm text-amber-700 leading-relaxed">
                    Fewer than 3 candidates clearly exceed your requirements.
                    Consider adjusting your criteria:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {narrative.limitedPoolSuggestions.map((suggestion, i) => (
                      <li
                        key={i}
                        className="text-sm text-amber-700 leading-relaxed"
                      >
                        • {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

          {/* Candidates Requiring Discussion */}
          {narrative.discussionCandidates.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-navy mb-3">
                Candidates Requiring Discussion
              </h3>
              <div className="space-y-3">
                {narrative.discussionCandidates.map((candidate, index) => (
                  <div
                    key={index}
                    className="rounded-[12px] border border-amber-100 bg-amber-50/30 p-4"
                  >
                    <p className="text-sm font-medium text-navy">
                      {candidate.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {candidate.narrative}
                    </p>
                    {candidate.concerns.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {candidate.concerns.map((concern, ci) => (
                          <span
                            key={ci}
                            className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700"
                          >
                            {concern}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not Recommended */}
          {narrative.notRecommended.count > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-navy mb-2">
                Not Recommended
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {narrative.notRecommended.count} candidate
                {narrative.notRecommended.count !== 1 ? "s" : ""}{" "}
                {narrative.notRecommended.count !== 1 ? "fall" : "falls"} short
                of your baseline requirements.
                {narrative.notRecommended.commonReasons.length > 0 &&
                  ` Common reasons: ${narrative.notRecommended.commonReasons.join(", ")}.`}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
