"use client";

import Link from "next/link";
import { Plus, ArrowRight, Sparkles, Upload, Users, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/features/home/components/empty-state";
import { LoadingWrapper } from "@/components/shared/loading-wrapper";
import { HomePageSkeleton } from "@/features/home/components/home-page-skeleton";
import { NetworkErrorCard } from "@/components/shared/network-error-card";
import { useProjects } from "@/lib/hooks";

// ─── Page component ──────────────────────────────────────────────────────────

export default function HomePage() {
  const { data, isLoading, error, refetch } = useProjects();

  const projects = data?.items ?? [];
  const openProjects = projects
    .filter((p) => p.state !== "Filled" && p.state !== "Cancelled")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const hasProjects = openProjects.length > 0;

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
          {/* ─── Personalized Header ─── */}
          <header className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-navy">
              Good {getGreeting()}.
            </h1>
            <p className="text-[15px] text-gray-500">
              You have {openProjects.length} active hiring {openProjects.length === 1 ? "project" : "projects"}.
            </p>
          </header>

          {/* ─── AI Brief ─── */}
          <section className="rounded-2xl border border-gray-100 bg-white p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0099CC]/10 to-[#0099CC]/5">
                <Sparkles className="h-4 w-4 text-[#0099CC]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-navy">AI Hiring Brief</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {openProjects.length === 1
                    ? `Your project "${openProjects[0].title}" is in ${openProjects[0].state} state. Upload resumes to get AI-powered candidate rankings and insights.`
                    : `You have ${openProjects.length} active projects. Upload resumes to any project to get AI-powered candidate rankings.`}
                </p>
                <div className="mt-4">
                  <Link
                    href={`/projects/${openProjects[0].id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0099CC] hover:text-[#007aa3] transition-colors"
                  >
                    Continue with {openProjects[0].title}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Projects ─── */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-navy">Projects</h2>
              <Button
                className="inline-flex items-center gap-1.5 bg-[#0099CC] text-white hover:bg-[#007aa3] rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm"
                render={<Link href="/projects/new" />}
              >
                <Plus className="h-3.5 w-3.5" />
                New Project
              </Button>
            </div>

            <div className="space-y-3">
              {openProjects.map((project) => (
                <ProjectRow
                  key={project.id}
                  id={project.id}
                  title={project.title}
                  status={project.state}
                  updatedAt={project.updated_at}
                />
              ))}
            </div>
          </section>

          {/* ─── Progress ─── */}
          <section className="rounded-2xl border border-gray-100 bg-white p-6">
            <h3 className="text-sm font-semibold text-navy">Hiring Progress</h3>
            <div className="mt-4 space-y-3">
              <ProgressStep done label="Project created" />
              <ProgressStep done={openProjects.some(p => p.state !== "Draft")} label="Job description added" />
              <ProgressStep done={false} label="Resumes uploaded" />
              <ProgressStep done={false} label="AI rankings generated" />
              <ProgressStep done={false} label="Interviews scheduled" />
            </div>
          </section>
        </div>
      )}
    </LoadingWrapper>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// ─── Project Row ─────────────────────────────────────────────────────────────

const statusDot: Record<string, string> = {
  Draft: "bg-gray-400",
  Active: "bg-emerald-500",
  Reviewing: "bg-amber-500",
  Interviewing: "bg-blue-500",
  "Offer Extended": "bg-purple-500",
};

function ProjectRow({ id, title, status, updatedAt }: { id: string; title: string; status: string; updatedAt: string }) {
  const relTime = formatRelative(updatedAt);

  return (
    <Link
      href={`/projects/${id}`}
      className={cn(
        "group flex items-center gap-4 rounded-xl border border-gray-100 bg-white px-5 py-4",
        "hover:border-[#0099CC]/20 hover:shadow-sm transition-all duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0099CC]"
      )}
    >
      {/* Status indicator */}
      <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", statusDot[status] ?? "bg-gray-400")} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-navy group-hover:text-[#0099CC] transition-colors truncate">
          {title}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          {status} · {relTime}
        </p>
      </div>

      {/* Action hint */}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-[#0099CC] transition-colors" />
    </Link>
  );
}

// ─── Progress Step ───────────────────────────────────────────────────────────

function ProgressStep({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "flex h-5 w-5 items-center justify-center rounded-full border",
        done
          ? "border-emerald-500 bg-emerald-50"
          : "border-gray-200 bg-white"
      )}>
        {done && (
          <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={cn(
        "text-sm",
        done ? "text-gray-500 line-through" : "text-navy"
      )}>
        {label}
      </span>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
