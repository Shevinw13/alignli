"use client";

import Link from "next/link";
import { Plus, FileText, Users, Sparkles } from "lucide-react";
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
  const showGettingStarted = openProjects.length > 0 && openProjects.length <= 3;

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
            {/* Compact header with gradient */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#5B21B6] to-[#4338CA] p-5 md:p-6">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-violet-300/10 blur-2xl" />

              <div className="relative flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-lg font-bold text-white">
                    Hiring Projects
                  </h1>
                  <p className="mt-0.5 text-sm text-white/70">
                    {openProjects.length} active{closedProjects.length > 0 ? ` · ${closedProjects.length} completed` : ""}
                  </p>
                </div>
                <Button
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    "bg-white text-[#5B21B6] hover:bg-white/90",
                    "rounded-[10px] px-4 py-2.5 text-sm font-semibold shadow-sm"
                  )}
                  render={<Link href="/projects/new" />}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New Project
                </Button>
              </div>
            </div>

            {/* Getting Started tips — shown when user is new (≤3 projects) */}
            {showGettingStarted && (
              <section className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/50 to-white p-5 md:p-6">
                <h3 className="text-sm font-semibold text-gray-900">How Narrowli works</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <GettingStartedStep
                    number={1}
                    title="Paste your job description"
                    description=""
                    icon={FileText}
                    done={false}
                  />
                  <GettingStartedStep
                    number={2}
                    title="Upload candidate resumes"
                    description=""
                    icon={Users}
                    done={false}
                  />
                  <GettingStartedStep
                    number={3}
                    title="Interview with confidence"
                    description=""
                    icon={Sparkles}
                    done={false}
                  />
                </div>
              </section>
            )}

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
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 px-1.5 text-xs font-semibold text-violet-600">
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

// ─── Getting Started Step ────────────────────────────────────────────────────

function GettingStartedStep({
  number,
  title,
  description,
  icon: Icon,
}: {
  number: number;
  title: string;
  description: string;
  icon: typeof FileText;
  done: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-lg p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
        <Icon className="h-4 w-4 text-violet-600" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
          {description}
        </p>
      </div>
    </div>
  );
}
