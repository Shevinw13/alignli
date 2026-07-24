"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface AIBriefData {
  totalCandidates: number;
  scoreDistribution: string;
  topHighlights: string[];
  patterns: string[];
  recommendedAction: string;
}

interface AIBriefProps {
  data: AIBriefData | null;
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
  zeroCandidates: boolean;
}

export function AIBrief({
  data,
  isLoading,
  error,
  onRetry,
  zeroCandidates,
}: AIBriefProps) {
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

      {/* Loading state */}
      {isLoading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Generating AI Brief…</span>
        </div>
      )}

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
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-navy">
              Total Candidates:
            </span>
            <span className="text-sm text-muted-foreground">0</span>
          </div>
          <p className="text-sm text-muted-foreground">
            No candidates have been added to this project yet. Upload resumes to
            get started with AI-powered analysis.
          </p>
        </div>
      )}

      {/* Brief content */}
      {!isLoading && !error && data && !zeroCandidates && (
        <div className="mt-4 space-y-4">
          {/* Total Candidates */}
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-navy">
              Total Candidates:
            </span>
            <span className="text-2xl font-bold text-indigo-600">
              {data.totalCandidates}
            </span>
          </div>

          {/* Score Distribution */}
          <div>
            <h3 className="text-sm font-medium text-navy">
              Score Distribution
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.scoreDistribution}
            </p>
          </div>

          {/* Top Highlights */}
          {data.topHighlights.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-navy">Top Highlights</h3>
              <ul className="mt-1 space-y-1">
                {data.topHighlights.map((highlight, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400"
                      aria-hidden="true"
                    />
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Patterns */}
          {data.patterns.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-navy">Patterns</h3>
              <ul className="mt-1 space-y-1">
                {data.patterns.map((pattern, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                      aria-hidden="true"
                    />
                    {pattern}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Action */}
          <div className="rounded-[12px] border border-indigo-100 bg-indigo-50 p-4">
            <h3 className="text-sm font-medium text-indigo-700">
              Recommended Action
            </h3>
            <p className="mt-1 text-sm text-indigo-600">
              {data.recommendedAction}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
