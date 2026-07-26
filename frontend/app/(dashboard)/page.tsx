"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, FileText, Users, Sparkles, CheckCircle2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/features/home/components/project-card";
import { ClosedProjectCard } from "@/features/home/components/closed-project-card";
import { EmptyState } from "@/features/home/components/empty-state";
import { LoadingWrapper } from "@/components/shared/loading-wrapper";
import { HomePageSkeleton } from "@/features/home/components/home-page-skeleton";
import { NetworkErrorCard } from "@/components/shared/network-error-card";
import { useProjects } from "@/lib/hooks";
import { transitionProjectState, deleteProject, getHiringStats } from "@/lib/services/projects";

export default function HomePage() {
  const { data, isLoading, error, refetch } = useProjects();
  const [closingId, setClosingId] = useState<string | null>(null);

  const projects = data?.items ?? [];
  const openProjects = projects
    .filter((p) => p.state !== "Filled" && p.state !== "Cancelled")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const closedProjects = projects
    .filter((p) => p.state === "Filled" || p.state === "Cancelled")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const hasProjects = openProjects.length > 0 || closedProjects.length > 0;
  const showGettingStarted = projects.length <= 3;

  // Fetch real metrics from API
  const [stats, setStats] = useState({ total_screened: 0, avg_score: 0 });
  useEffect(() => {
    if (!hasProjects) return;
    getHiringStats()
      .then((res) => setStats(res.data))
      .catch(() => {}); // Silently fail — metrics are non-critical
  }, [hasProjects]);

  async function handleMarkFilled(projectId: string) {
    setClosingId(projectId);
    try {
      await transitionProjectState(projectId, "Filled");
      refetch();
    } catch (err) {
      console.error("Failed to mark as filled:", err);
    } finally {
      setClosingId(null);
    }
  }

  async function handleReopen(projectId: string) {
    try {
      await transitionProjectState(projectId, "Active");
      refetch();
    } catch (err) {
      console.error("Failed to reopen:", err);
    }
  }

  async function handleDelete(projectId: string, title: string) {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
    try {
      await deleteProject(projectId);
      refetch();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  if (error) {
    return (
      <NetworkErrorCard
        title="Unable to load jobs"
        description={error.message || "Please check your connection and try again."}
        onRetry={refetch}
      />
    );
  }

  return (
    <LoadingWrapper isLoading={isLoading} skeleton={<HomePageSkeleton />}>
      <div className="space-y-8">
        {!hasProjects && <EmptyState />}

        {hasProjects && (
          <>
            {/* Header banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#5B21B6] via-[#4C1D95] to-[#3730A3] p-6 md:p-7">
              <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-6 left-1/4 h-32 w-32 rounded-full bg-indigo-400/10 blur-2xl" />

              <div className="relative flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Your Jobs
                  </h1>
                  <p className="mt-1 text-sm text-violet-200">
                    {openProjects.length} active{closedProjects.length > 0 ? ` · ${closedProjects.length} filled` : ""}
                  </p>
                </div>
                <Button
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    "bg-white text-[#5B21B6] hover:bg-violet-50",
                    "rounded-lg px-5 py-2.5 text-sm font-semibold shadow-lg shadow-black/10"
                  )}
                  render={<Link href="/projects/new" />}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New Job
                </Button>
              </div>

              {/* Metrics row */}
              <div className="relative mt-5 grid grid-cols-3 gap-3">
                <MetricTile
                  label="Screened"
                  value={stats.total_screened}
                  tooltip="Total candidates analyzed by AI across all your jobs"
                />
                <MetricTile
                  label="Avg Score"
                  value={stats.avg_score > 0 ? `${stats.avg_score}%` : "—"}
                  tooltip="Average AI match score across all scored candidates (0-100%)"
                />
                <MetricTile
                  label="Filled"
                  value={closedProjects.length}
                  tooltip="Number of jobs you've successfully filled"
                />
              </div>
            </div>

            {/* How it works */}
            {showGettingStarted && (
              <section className="rounded-xl border border-violet-100/80 bg-white p-5 md:p-6">
                <h3 className="text-sm font-semibold text-gray-900 tracking-tight">How it works</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <GettingStartedStep
                    number={1}
                    title="Describe the role"
                    description="Paste a job description or tell us what you're looking for"
                    icon={FileText}
                    done={false}
                  />
                  <GettingStartedStep
                    number={2}
                    title="Drop in resumes"
                    description="Upload PDFs, paste text, or import from LinkedIn"
                    icon={Users}
                    done={false}
                  />
                  <GettingStartedStep
                    number={3}
                    title="See who's best"
                    description="Ranked results with reasoning in under 60 seconds"
                    icon={Sparkles}
                    done={false}
                  />
                </div>
              </section>
            )}

            {/* Active jobs */}
            {openProjects.length > 0 && (
              <section aria-labelledby="open-projects-heading">
                <div className="flex items-center gap-2 mb-4">
                  <h2 id="open-projects-heading" className="text-[15px] font-semibold text-gray-900">
                    Active
                  </h2>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 px-1.5 text-xs font-semibold text-violet-600">
                    {openProjects.length}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {openProjects.map((project) => (
                    <div key={project.id} className="relative group/card">
                      <ProjectCard
                        id={project.id}
                        title={project.title}
                        status={project.state}
                        candidateCount={0}
                        topMatchesCount={0}
                        updatedAt={project.updated_at}
                      />
                      {/* Quick actions on hover */}
                      <div className={cn(
                        "absolute bottom-3 right-3 z-10 flex items-center gap-1.5",
                        "opacity-0 group-hover/card:opacity-100 transition-opacity"
                      )}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(project.id, project.title);
                          }}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                          aria-label={`Delete ${project.title}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleMarkFilled(project.id);
                          }}
                          disabled={closingId === project.id}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm text-gray-500 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50"
                          aria-label={`Mark ${project.title} as filled`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {closingId === project.id ? "..." : "Filled"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Filled jobs */}
            {closedProjects.length > 0 && (
              <section aria-labelledby="closed-projects-heading">
                <h2 id="closed-projects-heading" className="text-[15px] font-semibold text-gray-400 mb-3">
                  Filled
                </h2>
                <div className="space-y-2">
                  {closedProjects.map((project) => (
                    <ClosedProjectCard
                      key={project.id}
                      id={project.id}
                      title={project.title}
                      filledDate={project.updated_at}
                      onReopen={handleReopen}
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
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
          {description}
        </p>
      </div>
    </div>
  );
}

// ─── Metric Tile ─────────────────────────────────────────────────────────────

function MetricTile({ label, value, tooltip }: { label: string; value: string | number; tooltip: string }) {
  return (
    <div className="group/metric relative rounded-lg bg-white/10 backdrop-blur-sm px-4 py-3">
      <p className="text-[11px] font-medium text-violet-200">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-white">{value}</p>

      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-md bg-gray-900 text-[11px] text-white whitespace-nowrap opacity-0 group-hover/metric:opacity-100 transition-opacity pointer-events-none shadow-lg z-20">
        {tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  );
}
