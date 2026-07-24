"use client";

import { Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComparisonSummaryData } from "./types";

interface ComparisonSummaryProps {
  data: ComparisonSummaryData | null;
  isLoading: boolean;
}

export function ComparisonSummary({ data, isLoading }: ComparisonSummaryProps) {
  return (
    <section
      className={cn(
        "rounded-[16px] border border-border bg-white p-6",
        "transition-shadow hover:shadow-[0_2px_4px_rgba(0,0,0,0.05)]"
      )}
      aria-labelledby="comparison-summary-heading"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-indigo-50 text-indigo-600">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2
          id="comparison-summary-heading"
          className="text-lg font-semibold text-navy"
        >
          AI Comparison Summary
        </h2>
      </div>

      {isLoading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Generating comparison summary…</span>
        </div>
      )}

      {!isLoading && data && (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {data.summary}
          </p>
          <p className="mt-3 text-xs text-muted-foreground/70">
            Generated {data.generatedAt}
          </p>
        </div>
      )}

      {!isLoading && !data && (
        <p className="mt-4 text-sm text-muted-foreground">
          No comparison summary available.
        </p>
      )}
    </section>
  );
}
