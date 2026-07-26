"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoadingWrapper } from "@/components/shared/loading-wrapper";
import { NetworkErrorCard } from "@/components/shared/network-error-card";
import { ProjectDetailSkeleton } from "@/features/hiring-project/components/project-detail-skeleton";
import { LifecycleBadge, type ProjectState } from "@/features/hiring-project";
import { RankedResults } from "@/features/hiring-project/components/ranked-results";
import { ResumeUploadStep } from "@/features/project-creation/components/resume-upload-step";
import { useProject } from "@/lib/hooks";
import { analyzeProjectCandidates } from "@/lib/services/candidates";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: project, isLoading, error, refetch } = useProject(params.id);
  const [showUpload, setShowUpload] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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

  async function handleUploadContinue(_files: File[]) {
    // After upload, re-trigger analysis
    setShowUpload(false);
    setIsReanalyzing(true);
    try {
      await analyzeProjectCandidates(params.id);
      // Force refresh of ranked results
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Re-analysis failed:", err);
    } finally {
      setIsReanalyzing(false);
    }
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
          <RankedResults key={refreshKey} projectTitle={project.title} projectId={params.id} />

          {/* Re-analyzing indicator */}
          {isReanalyzing && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
              Re-analyzing candidates... usually under 60 seconds
            </div>
          )}

          {/* Add more candidates section */}
          {!showUpload ? (
            <div className="pt-2">
              <Button
                onClick={() => setShowUpload(true)}
                variant="outline"
                className="text-sm gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Add more candidates
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Add more candidates</h3>
                <button
                  onClick={() => setShowUpload(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Close upload panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ResumeUploadStep
                onContinue={handleUploadContinue}
                projectId={params.id}
              />
            </div>
          )}
        </div>
      )}
    </LoadingWrapper>
  );
}
