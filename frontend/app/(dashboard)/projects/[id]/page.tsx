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
          <p className="text-sm text-muted-foreground">
            Communication tab — coming in task 16.3.
          </p>
        </div>
      )}

      {activeTab === "settings" && (
        <div
          role="tabpanel"
          id="tabpanel-settings"
          aria-labelledby="tab-settings"
          className="pt-6"
        >
          <p className="text-sm text-muted-foreground">
            Settings tab — coming in task 16.4.
          </p>
        </div>
      )}
      </div>
      )}
    </LoadingWrapper>
  );
}
