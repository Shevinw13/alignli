"use client";

import Link from "next/link";
import { ArrowRight, Users, Star, Calendar, Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectCardProps {
  id: string;
  title: string;
  status: string;
  candidateCount: number;
  topMatchesCount: number;
  updatedAt?: string;
}

const statusConfig: Record<string, { bg: string; text: string; accent: string; dot: string }> = {
  Draft: { bg: "bg-gray-50", text: "text-gray-600", accent: "from-gray-300 to-gray-400", dot: "bg-gray-400" },
  "In Progress": { bg: "bg-sky-50", text: "text-sky-700", accent: "from-sky-400 to-sky-500", dot: "bg-sky-500" },
  Active: { bg: "bg-emerald-50", text: "text-emerald-700", accent: "from-emerald-400 to-emerald-500", dot: "bg-emerald-500" },
  Reviewing: { bg: "bg-amber-50", text: "text-amber-700", accent: "from-amber-400 to-amber-500", dot: "bg-amber-500" },
  Interviewing: { bg: "bg-blue-50", text: "text-blue-700", accent: "from-blue-400 to-blue-500", dot: "bg-blue-500" },
  "Offer Extended": { bg: "bg-purple-50", text: "text-purple-700", accent: "from-purple-400 to-purple-500", dot: "bg-purple-500" },
};

// Contextual next-action hints based on project state
const nextActionHint: Record<string, { icon: typeof Upload; text: string }> = {
  Draft: { icon: Upload, text: "Add resumes → get instant rankings" },
  Active: { icon: FileText, text: "View your ranked candidates" },
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
  const hint = !hasStats ? nextActionHint[status] : null;

  return (
    <Link
      href={`/projects/${id}`}
      className={cn(
        "group relative block overflow-hidden rounded-[16px] border border-border bg-white",
        "shadow-sm hover:shadow-md transition-shadow duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
      )}
    >
      {/* Gradient top accent bar — thicker for visibility */}
      <div className={cn("h-1.5 w-full bg-gradient-to-r", config.accent)} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold text-navy group-hover:text-violet-600 transition-colors">
              {title}
            </h3>
            <div className="mt-2.5 flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", config.dot)} />
                <span className={cn("text-xs font-medium", config.text)}>
                  {status}
                </span>
              </span>
              {updatedAt && (
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  {formatRelativeDate(updatedAt)}
                </span>
              )}
            </div>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-50 group-hover:bg-violet-100 transition-colors">
            <ArrowRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-violet-600 transition-colors" aria-hidden="true" />
          </div>
        </div>

        {/* Stats row (when candidates exist) */}
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

        {/* Next action hint (when no candidates yet) */}
        {hint && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#f0fafb] px-3 py-2">
            <hint.icon className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />
            <span className="text-xs text-violet-700">{hint.text}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
