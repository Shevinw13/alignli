"use client";

import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LoadingWrapper } from "@/components/shared/loading-wrapper";
import { NetworkErrorCard } from "@/components/shared/network-error-card";
import { ProjectDetailSkeleton } from "@/features/hiring-project/components/project-detail-skeleton";
import { LifecycleBadge, type ProjectState } from "@/features/hiring-project";
import { RankedResults } from "@/features/hiring-project/components/ranked-results";
import { useProject } from "@/lib/hooks";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
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
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  "text-gray-400 hover:bg-violet-50 hover:text-violet-600",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
                )}
                aria-label="Back to projects"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{project.title}</h1>
              </div>
            </div>
            <LifecycleBadge state={project.state as ProjectState} />
          </div>

          {/* Results */}
          <RankedResults projectTitle={project.title} />
        </div>
      )}
    </LoadingWrapper>
  );
}
