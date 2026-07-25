"use client";

import Link from "next/link";
import { ArrowRight, Users, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProjectCardProps {
  id: string;
  title: string;
  status: "In Progress" | "Active" | "Reviewing" | "Interviewing" | "Offer Extended";
  candidateCount: number;
  topMatchesCount: number;
}

const statusStyles: Record<string, string> = {
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
  return (
    <div
      className={cn(
        "rounded-[16px] border border-border bg-white p-4",
        "hover-elevate"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-navy">{title}</h3>
          <span
            className={cn(
              "mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
              statusStyles[status] ?? "bg-gray-100 text-gray-700"
            )}
          >
            {status}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>
            {candidateCount} {candidateCount === 1 ? "candidate" : "candidates"}
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-emerald-600">
          <Star className="h-4 w-4" aria-hidden="true" />
          <span>
            {topMatchesCount} top {topMatchesCount === 1 ? "match" : "matches"}
          </span>
        </span>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <Link
          href={`/projects/${id}`}
          className={cn(
            "inline-flex items-center gap-1 text-sm font-medium",
            "text-indigo-600 hover:text-indigo-700",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          )}
        >
          Continue
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
