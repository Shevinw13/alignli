"use client";

import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectCardProps {
  id: string;
  title: string;
  status: string;
  candidateCount: number;
  topMatchesCount: number;
  updatedAt?: string;
}

function formatRelativeDate(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ProjectCard({
  id,
  title,
  status,
  candidateCount,
  topMatchesCount,
  updatedAt,
}: ProjectCardProps) {
  const hasCandidates = candidateCount > 0;

  return (
    <Link
      href={`/projects/${id}`}
      className={cn(
        "group block rounded-xl border border-gray-200 bg-white p-5",
        "hover:border-violet-200 hover:shadow-sm transition-all duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
      )}
    >
      {/* Title + arrow */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-gray-900 group-hover:text-violet-700 transition-colors truncate">
          {title}
        </h3>
        <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-violet-500 transition-colors mt-0.5" aria-hidden="true" />
      </div>

      {/* Meta line */}
      <p className="mt-2 text-xs text-gray-400">
        {updatedAt && formatRelativeDate(updatedAt)}
        {hasCandidates && ` · ${candidateCount} candidate${candidateCount !== 1 ? "s" : ""}`}
        {topMatchesCount > 0 && ` · ${topMatchesCount} top`}
      </p>

      {/* Action hint when no candidates */}
      {!hasCandidates && (
        <div className="mt-3 flex items-center gap-2 text-xs text-violet-600">
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Add resumes to get rankings</span>
        </div>
      )}
    </Link>
  );
}
