"use client";

import Link from "next/link";
import { ArrowRight, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ClosedProjectCardProps {
  id: string;
  title: string;
  filledDate: string;
  onReopen?: (id: string) => void;
  onDelete?: (id: string, title: string) => void;
}

export function ClosedProjectCard({
  id,
  title,
  filledDate,
  onReopen,
  onDelete,
}: ClosedProjectCardProps) {
  const formattedDate = new Date(filledDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between gap-4",
        "rounded-xl border border-gray-200 bg-white px-5 py-4"
      )}
    >
      <Link href={`/projects/${id}`} className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-medium text-gray-500 group-hover:text-violet-700 transition-colors">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-gray-400">
          Filled {formattedDate}
        </p>
      </Link>

      <div className="flex items-center gap-2 shrink-0">
        {onDelete && (
          <button
            onClick={(e) => { e.preventDefault(); onDelete(id, title); }}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
              "border border-gray-200 text-gray-400",
              "hover:text-red-600 hover:border-red-200 hover:bg-red-50",
              "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
        {onReopen && (
          <button
            onClick={(e) => { e.preventDefault(); onReopen(id); }}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
              "border border-gray-200 text-gray-400",
              "hover:text-violet-700 hover:border-violet-200 hover:bg-violet-50",
              "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
          >
            <RotateCcw className="h-3 w-3" />
            Reopen
          </button>
        )}
        <Link
          href={`/projects/${id}`}
          className="text-gray-300 group-hover:text-violet-500 transition-colors"
          aria-label={`View ${title}`}
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
