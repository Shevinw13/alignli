"use client";

import Link from "next/link";
import { ArrowRight, Users, Star, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectCardProps {
  id: string;
  title: string;
  status: string;
  candidateCount: number;
  topMatchesCount: number;
  updatedAt?: string;
}

const statusConfig: Record<string, { bg: string; text: string; accent: string }> = {
  Draft: { bg: "bg-gray-50", text: "text-gray-600", accent: "bg-gray-400" },
  "In Progress": { bg: "bg-sky-50", text: "text-sky-700", accent: "bg-sky-500" },
  Active: { bg: "bg-emerald-50", text: "text-emerald-700", accent: "bg-emerald-500" },
  Reviewing: { bg: "bg-amber-50", text: "text-amber-700", accent: "bg-amber-500" },
  Interviewing: { bg: "bg-blue-50", text: "text-blue-700", accent: "bg-blue-500" },
  "Offer Extended": { bg: "bg-purple-50", text: "text-purple-700", accent: "bg-purple-500" },
};

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
  const hasStats = candidateCount > 0 || topMatchesCount > 0;
  const config = statusConfig[status] ?? statusConfig.Draft;

  return (
    <Link
      href={`/projects/${id}`}
      className={cn(
        "group relative block overflow-hidden rounded-[16px] border border-border bg-white",
        "hover-elevate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0099CC]"
      )}
    >
      {/* Colored top accent bar */}
      <div className={cn("h-1 w-full", config.accent)} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold text-navy group-hover:text-[#0099CC] transition-colors">
              {title}
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  config.bg, config.text
                )}
              >
                {status}
              </span>
              {updatedAt && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  {formatRelativeDate(updatedAt)}
                </span>
              )}
            </div>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-50 group-hover:bg-[#e6f7fc] transition-colors">
            <ArrowRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-[#0099CC] transition-colors" aria-hidden="true" />
          </div>
        </div>

        {hasStats && (
          <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{candidateCount} candidates</span>
            </span>
            {topMatchesCount > 0 && (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <Star className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{topMatchesCount} top matches</span>
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
