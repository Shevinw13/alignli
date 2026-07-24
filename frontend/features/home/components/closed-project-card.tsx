"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ClosedProjectCardProps {
  id: string;
  title: string;
  filledDate: string; // ISO date string or formatted date
}

export function ClosedProjectCard({
  id,
  title,
  filledDate,
}: ClosedProjectCardProps) {
  const formattedDate = new Date(filledDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        "rounded-[16px] border border-border bg-white px-6 py-4"
      )}
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-navy">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Filled {formattedDate}
        </p>
      </div>

      <Link
        href={`/projects/${id}`}
        className={cn(
          "shrink-0 text-sm font-medium",
          "text-indigo-600 hover:text-indigo-700",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        )}
      >
        View
      </Link>
    </div>
  );
}
