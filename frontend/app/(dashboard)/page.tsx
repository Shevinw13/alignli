"use client";

import Link from "next/link";
import { Plus, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/features/home/components/empty-state";
import { LoadingWrapper } from "@/components/shared/loading-wrapper";
import { HomePageSkeleton } from "@/features/home/components/home-page-skeleton";
import { NetworkErrorCard } from "@/components/shared/network-error-card";
import { useProjects } from "@/lib/hooks";

export default function HomePage() {
  const { data, isLoading, error, refetch } = useProjects();

  const projects = data?.items ?? [];
  const openProjects = projects
    .filter((p) => p.state !== "Filled" && p.state !== "Cancelled")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const closedProjects = projects
    .filter((p) => p.state === "Filled" || p.state === "Cancelled")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const hasProjects = openProjects.length > 0 || closedProjects.length > 0;

  if (error) {
    return (
      <NetworkErrorCard
        title="Unable to load projects"
        description={error.message || "Please check your connection and try again."}
        onRetry={refetch}
      />
    );
  }

  return (
    <LoadingWrapper isLoading={isLoading} skeleton={<HomePageSkeleton />}>
      {!hasProjects ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {/* Page header — clean, strong typography */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Projects</h1>
            <Button
              className="inline-flex items-center gap-1.5 bg-violet-600 text-white hover:bg-violet-700 rounded-lg px-4 py-2.5 text-sm font-medium"
              render={<Link href="/projects/new" />}
            >
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>

          {/* Project list */}
          <div className="space-y-2">
            {openProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group flex items-center justify-between rounded-xl border border-gray-200/80 bg-white px-5 py-4 hover:border-violet-200 hover:bg-violet-50/30 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Status dot */}
                  <div className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    project.state === "Active" ? "bg-emerald-500" :
                    project.state === "Draft" ? "bg-gray-300" :
                    "bg-violet-500"
                  )} />

                  {/* Title + meta */}
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-gray-900 group-hover:text-violet-700 transition-colors truncate">
                      {project.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {project.state} · Updated {formatRelative(project.updated_at)}
                    </p>
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-violet-500 transition-colors shrink-0" />
              </Link>
            ))}

            {closedProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-5 py-3.5 hover:bg-white hover:border-gray-200 transition-all duration-150"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-2 w-2 rounded-full bg-gray-300 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500 truncate">{project.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Completed · {formatRelative(project.updated_at)}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </LoadingWrapper>
  );
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
