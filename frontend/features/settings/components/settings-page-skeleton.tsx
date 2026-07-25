"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for the settings page team management content.
 * Matches the layout of section header + table content.
 */
export function SettingsPageSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading settings">
      {/* Team management section header */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton variant="text" className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-36 rounded-[12px]" />
        </div>

        {/* Filter controls skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>

        {/* Table skeleton */}
        <div className="rounded-[12px] border border-border bg-white overflow-hidden">
          {/* Search row */}
          <div className="border-b border-border px-4 py-3">
            <Skeleton className="h-8 w-64 rounded-[8px]" />
          </div>

          {/* Table header */}
          <div className="flex items-center gap-4 border-b border-border px-4 py-3 bg-gray-50/50">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-14 ml-auto" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-6" />
          </div>

          {/* Table rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-4 w-4" />
              <div className="flex items-center gap-3 flex-1">
                <Skeleton variant="circular" className="h-8 w-8" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton variant="text" className="h-3 w-36" />
                </div>
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton variant="text" className="h-4 w-20" />
              <Skeleton className="h-6 w-6 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Role permissions section skeleton */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton variant="text" className="h-4 w-72" />
        </div>
        <Skeleton className="h-48 w-full rounded-[12px]" />
      </div>
    </div>
  );
}
