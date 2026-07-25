"use client";

import Link from "next/link";
import { Plus, Sparkles, TrendingUp, Clock } from "lucide-react";
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
        {/* Empty state */}
        {!hasProjects && <EmptyState />}

        {/* Dashboard with projects */}
        {hasProjects && (
          <>
            {/* Welcome header with gradient accent */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0099CC] to-[#007aa3] p-6 md:p-8">
              <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5 blur-xl" />

              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white">
                    Your Hiring Projects
                  </h1>
                  <p className="mt-1 text-sm text-white/80">
                    {openProjects.length} active · {closedProjects.length} completed
                  </p>
                </div>
                <Button
                  className={cn(
                    "inline-flex items-center gap-1.5 self-start sm:self-auto",
                    "bg-white text-[#0099CC] hover:bg-white/90",
                    "rounded-[10px] px-4 py-2 text-sm font-semibold shadow-sm"
                  )}
                  render={<Link href="/projects/new" />}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New Project
                </Button>
              </div>

              {/* Quick stats row */}
              <div className="relative mt-6 grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-white/70" aria-hidden="true" />
                    <span className="text-xs font-medium text-white/70">Active</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-white">{openProjects.length}</p>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-white/70" aria-hidden="true" />
                    <span className="text-xs font-medium text-white/70">Candidates</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-white">—</p>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-white/70" aria-hidden="true" />
                    <span className="text-xs font-medium text-white/70">Filled</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-white">{closedProjects.length}</p>
                </div>
              </div>
            </div>

            {/* Open projects section */}
            {openProjects.length > 0 && (
              <section aria-labelledby="open-projects-heading">
                <div className="flex items-center gap-2 mb-4">
                  <h2
                    id="open-projects-heading"
                    className="text-base font-semibold text-navy"
                  >
                    Active Projects
                  </h2>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e6f7fc] px-1.5 text-xs font-semibold text-[#0099CC]">
                    {openProjects.length}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {openProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      id={project.id}
                      title={project.title}
                      status={project.state}
                      candidateCount={0}
                      topMatchesCount={0}
                      updatedAt={project.updated_at}
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
                  className="text-base font-semibold text-navy mb-3"
                >
                  Completed
                </h2>

                <div className="space-y-2">
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
          </>
        )}
      </div>
    </LoadingWrapper>
  );
}
