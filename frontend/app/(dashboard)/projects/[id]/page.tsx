"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/shared";
import { LoadingWrapper } from "@/components/shared/loading-wrapper";
import { NetworkErrorCard } from "@/components/shared/network-error-card";
import { ProjectDetailSkeleton } from "@/features/hiring-project/components/project-detail-skeleton";
import {
  TabNavigation,
  LifecycleBadge,
  OverviewTab,
  CandidatesTab,
  type ProjectTab,
  type ProjectState,
  type AIBriefData,
} from "@/features/hiring-project";
import { useProject } from "@/lib/hooks";

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const { data: project, isLoading, error, refetch } = useProject(params.id);

  if (error) {
    return (
      <NetworkErrorCard
        title="Unable to load project"
        description={error.message || "Please check your connection and try again."}
        onRetry={refetch}
      />
    );
  }

  if (!project && !isLoading) {
    return (
      <NetworkErrorCard
        title="Project not found"
        description="This project may have been deleted or you don't have access to it."
        onRetry={refetch}
      />
    );
  }

  return (
    <LoadingWrapper isLoading={isLoading} skeleton={<ProjectDetailSkeleton />}>
      {project && (
      <div className="space-y-6">
        {/* Breadcrumb navigation */}
        <Breadcrumb
          items={[
            { label: "Projects", href: "/" },
            { label: project.title, href: `/projects/${project.id}` },
          ]}
        />

      {/* Page header with back link and lifecycle state */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-[8px]",
              "text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            )}
            aria-label="Back to projects"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-navy">{project.title}</h1>
          </div>
        </div>

        {/* Lifecycle state indicator — visible without scrolling */}
        <LifecycleBadge state={project.state as ProjectState} />
      </div>

      {/* Tab navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab
          projectTitle={project.title}
          jobSummary=""
          rankingCriteria={[]}
          resumeCount={0}
          interviewCount={0}
          totalCandidates={0}
          aiBriefData={null}
        />
      )}

      {activeTab === "candidates" && (
        <div
          role="tabpanel"
          id="tabpanel-candidates"
          aria-labelledby="tab-candidates"
          className="pt-6"
        >
          <CandidatesTab />
        </div>
      )}

      {activeTab === "communication" && (
        <div
          role="tabpanel"
          id="tabpanel-communication"
          aria-labelledby="tab-communication"
          className="pt-6"
        >
          <div className="flex flex-col items-center justify-center rounded-[16px] border border-border bg-white px-6 py-12 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
              <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-navy">Communication</h3>
            <p className="mt-1.5 max-w-xs text-xs text-muted-foreground">
              Send emails and track communication with candidates directly from here.
            </p>
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div
          role="tabpanel"
          id="tabpanel-settings"
          aria-labelledby="tab-settings"
          className="pt-6"
        >
          <div className="flex flex-col items-center justify-center rounded-[16px] border border-border bg-white px-6 py-12 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-navy">Project Settings</h3>
            <p className="mt-1.5 max-w-xs text-xs text-muted-foreground">
              Manage ranking criteria, team access, and project preferences.
            </p>
          </div>
        </div>
      )}
      </div>
      )}
    </LoadingWrapper>
  );
}
