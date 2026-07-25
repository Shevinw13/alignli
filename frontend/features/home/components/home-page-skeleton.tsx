"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for the dashboard home page.
 * Matches the layout of project cards in a responsive grid.
 */
export function HomePageSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading projects">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton variant="text" className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-44 rounded-[12px]" />
      </div>

      {/* Section heading skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton variant="circular" className="h-5 w-5" />
      </div>

      {/* Project cards grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>

      {/* Closed projects section skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-[16px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-[16px] border border-border bg-white p-6 space-y-4">
      {/* Title and status */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Footer link */}
      <div className="border-t border-border pt-4">
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}
