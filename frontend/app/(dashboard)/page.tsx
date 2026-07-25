"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/features/home/components/project-card";
import { ClosedProjectCard } from "@/features/home/components/closed-project-card";
import { EmptyState } from "@/features/home/components/empty-state";
import { LoadingWrapper } from "@/components/shared/loading-wrapper";
import { HomePageSkeleton } from "@/features/home/components/home-page-skeleton";
import { NetworkErrorCard } from "@/components/shared/network-error-card";
import { useProjects } from "@/lib/hooks";

// ─── Page component ──────────────────────────────────────────────────────────

export default function HomePage() {
  const { data, isLoading, error, refetch } = useProjects();

  // Derive open vs closed projects from API response
  const projects = data?.items ?? [];
  const openProjects = projects
    .filter((p) => p.state !== "Filled" && p.state !== "Cancelled")
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  const closedProjects = projects
    .filter((p) => p.state === "Filled" || p.state === "Cancelled")
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

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
      <div className="space-y-8">
        {/* Action bar */}
        {hasProjects && (
          <div className="flex items-center justify-end">
            <Button
              className={cn(
                "inline-flex items-center gap-1.5",
                "bg-indigo-600 text-white hover:bg-indigo-700",
                "rounded-[12px] px-4 py-2 text-sm font-medium"
              )}
              render={<Link href="/projects/new" />}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Hiring Project
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!hasProjects && <EmptyState />}

        {/* Open projects section */}
        {openProjects.length > 0 && (
          <section aria-labelledby="open-projects-heading">
            <div className="flex items-center gap-2">
              <h2
                id="open-projects-heading"
                className="text-lg font-semibold text-navy"
              >
                Open Hiring Projects
              </h2>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-medium text-indigo-700">
                {openProjects.length}
              </span>
            </div>

            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {openProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  title={project.title}
                  status={project.state}
                  candidateCount={0}
                  topMatchesCount={0}
                />
              ))}
            </div>
          </section>
        )}

        {/* Closed projects section */}
        {closedProjects.length > 0 && (
          <section aria-labelledby="closed-projects-heading">
            <h2
              id="closed-projects-heading"
              className="text-lg font-semibold text-navy"
            >
              Closed Projects
            </h2>

            <div className="mt-4 space-y-3">
              {closedProjects.map((project) => (
                <ClosedProjectCard
                  key={project.id}
                  id={project.id}
                  title={project.title}
                  filledDate={project.updated_at}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </LoadingWrapper>
  );
}
