"use client";

import { useState, useCallback } from "react";
import { Users, FileText, MessageSquare, ListChecks } from "lucide-react";
import { AIBrief, type AIBriefData } from "./ai-brief";
import { StatsCard } from "./stats-card";

interface RankingCriterion {
  category: string;
  label: string;
  priority: "Low" | "Medium" | "High";
}

interface OverviewTabProps {
  projectTitle: string;
  jobSummary: string;
  rankingCriteria: RankingCriterion[];
  resumeCount: number;
  interviewCount: number;
  totalCandidates: number;
  aiBriefData: AIBriefData | null;
}

export function OverviewTab({
  projectTitle,
  jobSummary,
  rankingCriteria,
  resumeCount,
  interviewCount,
  totalCandidates,
  aiBriefData,
}: OverviewTabProps) {
  const [briefData, setBriefData] = useState<AIBriefData | null>(aiBriefData);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState(false);

  const zeroCandidates = totalCandidates === 0;

  const handleRetry = useCallback(() => {
    setBriefError(false);
    setBriefLoading(true);
    // Simulate retry — real API call will be wired in task 20
    setTimeout(() => {
      setBriefLoading(false);
      if (aiBriefData) {
        setBriefData(aiBriefData);
      } else {
        setBriefError(true);
      }
    }, 1500);
  }, [aiBriefData]);

  return (
    <div
      role="tabpanel"
      id="tabpanel-overview"
      aria-labelledby="tab-overview"
      className="space-y-6 pt-6"
    >
      {/* AI Brief — signature element at top */}
      <AIBrief
        data={briefData}
        isLoading={briefLoading}
        error={briefError}
        onRetry={handleRetry}
        zeroCandidates={zeroCandidates}
      />

      {/* Stats cards row */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          label="Total Candidates"
          value={totalCandidates}
          icon={<Users className="h-5 w-5" aria-hidden="true" />}
        />
        <StatsCard
          label="Resumes Uploaded"
          value={resumeCount}
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
        />
        <StatsCard
          label="Interviews Scheduled"
          value={interviewCount}
          icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />}
        />
      </div>

      {/* Job Summary */}
      <section
        className="rounded-[16px] border border-border bg-white p-4"
        aria-labelledby="job-summary-heading"
      >
        <h3
          id="job-summary-heading"
          className="text-base font-semibold text-navy"
        >
          Job Summary
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {jobSummary || "No job description provided yet."}
        </p>
      </section>

      {/* Ranking Criteria */}
      <section
        className="rounded-[16px] border border-border bg-white p-4"
        aria-labelledby="ranking-criteria-heading"
      >
        <h3
          id="ranking-criteria-heading"
          className="text-base font-semibold text-navy"
        >
          Ranking Criteria
        </h3>
        {rankingCriteria.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No ranking criteria defined yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {rankingCriteria.map((criterion, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-[12px] border border-border px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy">
                    {criterion.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {criterion.category}
                  </p>
                </div>
                <PriorityBadge priority={criterion.priority} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: "Low" | "Medium" | "High" }) {
  const styles = {
    Low: "bg-gray-100 text-gray-600",
    Medium: "bg-amber-50 text-amber-700",
    High: "bg-emerald-50 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[priority]}`}
    >
      {priority}
    </span>
  );
}
