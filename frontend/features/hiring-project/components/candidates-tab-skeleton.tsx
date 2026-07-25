"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for the candidates tab.
 * Matches the layout of filter bar + candidate cards.
 */
export function CandidatesTabSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading candidates">
      {/* Filter bar skeleton */}
      <div className="flex flex-wrap items-end gap-4 rounded-[12px] border border-border bg-white p-4">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-20 rounded-[8px]" />
        <Skeleton className="h-8 w-20 rounded-[8px]" />
        <Skeleton className="h-8 w-28 rounded-[8px]" />
      </div>

      {/* Candidate cards skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <CandidateCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function CandidateCardSkeleton() {
  return (
    <div className="rounded-[16px] border border-border bg-white p-5">
      <div className="flex items-start gap-4">
        {/* Score ring placeholder */}
        <Skeleton variant="circular" className="h-12 w-12 shrink-0" />

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton variant="text" className="h-4 w-56" />
          <Skeleton variant="text" className="h-4 w-full max-w-md" />
        </div>

        {/* Meta */}
        <div className="hidden sm:flex flex-col items-end gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton variant="text" className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}
