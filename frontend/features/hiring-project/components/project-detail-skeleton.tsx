"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for the hiring project detail page.
 * Matches the layout of breadcrumb, header, tabs, and content area.
 */
export function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading project details">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton variant="text" className="h-4 w-16" />
        <Skeleton variant="text" className="h-4 w-4" />
        <Skeleton variant="text" className="h-4 w-40" />
      </div>

      {/* Page header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Skeleton variant="rectangular" className="h-8 w-8 rounded-[8px]" />
          <Skeleton className="h-7 w-56" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Tabs skeleton */}
      <div className="border-b border-border pb-0">
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-t-[8px]" />
          ))}
        </div>
      </div>

      {/* Tab content skeleton (overview-style) */}
      <div className="space-y-6 pt-2">
        {/* Stats cards row */}
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-[16px]" />
          ))}
        </div>

        {/* Content sections */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-32 w-full rounded-[16px]" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-[8px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
