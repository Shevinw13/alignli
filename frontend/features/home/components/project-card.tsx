"use client";

import Link from "next/link";
import { ArrowRight, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectCardProps {
  id: string;
  title: string;
  status: string;
  candidateCount: number;
  topMatchesCount: number;
}

const statusStyles: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700",
  "In Progress": "bg-sky-50 text-sky-700",
  Active: "bg-emerald-50 text-emerald-700",
  Reviewing: "bg-amber-50 text-amber-700",
  Interviewing: "bg-blue-50 text-blue-700",
  "Offer Extended": "bg-purple-50 text-purple-700",
};

export function ProjectCard({
  id,
  title,
  status,
  candidateCount,
  topMatchesCount,
}: ProjectCardProps) {
  const hasStats = candidateCount > 0 || topMatchesCount > 0;

  return (
    <Link
      href={`/projects/${id}`}
      className={cn(
        "group block rounded-[16px] border border-border bg-white p-5",
        "hover-elevate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0099CC]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-navy group-hover:text-[#0099CC] transition-colors">
            {title}
          </h3>
          <span
            className={cn(
              "mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
              statusStyles[status] ?? "bg-gray-100 text-gray-700"
            )}
          >
            {status}
          </span>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-[#0099CC] transition-colors mt-1" aria-hidden="true" />
      </div>

      {hasStats && (
        <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{candidateCount}</span>
          </span>
          {topMatchesCount > 0 && (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{topMatchesCount} top</span>
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
