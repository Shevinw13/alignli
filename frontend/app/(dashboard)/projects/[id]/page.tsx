"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  TabNavigation,
  LifecycleBadge,
  OverviewTab,
  CandidatesTab,
  type ProjectTab,
  type ProjectState,
  type AIBriefData,
} from "@/features/hiring-project";

// ─── Mock data (will be replaced by API integration in task 20) ──────────────

interface MockProjectData {
  id: string;
  title: string;
  state: ProjectState;
  jobSummary: string;
  rankingCriteria: {
    category: string;
    label: string;
    priority: "Low" | "Medium" | "High";
  }[];
  totalCandidates: number;
  resumeCount: number;
  interviewCount: number;
  aiBrief: AIBriefData | null;
}

const mockProjects: Record<string, MockProjectData> = {
  "1": {
    id: "1",
    title: "Senior Frontend Engineer",
    state: "Active",
    jobSummary:
      "We are looking for a Senior Frontend Engineer to join our product team and build high-quality user interfaces using React, TypeScript, and modern web technologies. The ideal candidate has 5+ years of experience, a passion for clean code, and strong communication skills.",
    rankingCriteria: [
      { category: "Skill Match", label: "React & TypeScript proficiency", priority: "High" },
      { category: "Experience", label: "5+ years frontend development", priority: "High" },
      { category: "Leadership", label: "Mentorship & code review experience", priority: "Medium" },
      { category: "Education", label: "Computer Science or related field", priority: "Low" },
      { category: "Certifications", label: "AWS or cloud certifications", priority: "Low" },
    ],
    totalCandidates: 24,
    resumeCount: 24,
    interviewCount: 5,
    aiBrief: {
      totalCandidates: 24,
      scoreDistribution:
        "4 candidates scored 90+, 8 candidates scored 75–89, 7 candidates scored 60–74, 5 candidates scored below 60.",
      topHighlights: [
        "Sarah Chen — 96/100 — 8 years React experience, led frontend platform at Stripe",
        "Marcus Johnson — 93/100 — Full-stack background with strong TypeScript skills",
        "Priya Patel — 91/100 — Open-source contributor, previous senior role at Vercel",
      ],
      patterns: [
        "Most high-scoring candidates have 6+ years of React-specific experience",
        "Candidates with open-source contributions tend to score higher on code quality",
        "Several strong candidates lack formal CS degrees but show strong self-taught trajectories",
      ],
      recommendedAction:
        "Schedule interviews with the top 5 candidates (score 90+). Consider a technical assessment for the 75–89 tier to differentiate between them.",
    },
  },
  "2": {
    id: "2",
    title: "Product Designer",
    state: "Draft",
    jobSummary:
      "Seeking a Product Designer to craft delightful user experiences for our hiring platform. Must have strong skills in Figma, user research, and design systems.",
    rankingCriteria: [
      { category: "Skill Match", label: "Figma expertise", priority: "High" },
      { category: "Experience", label: "3+ years product design", priority: "High" },
      { category: "Skill Match", label: "Design systems experience", priority: "Medium" },
    ],
    totalCandidates: 0,
    resumeCount: 0,
    interviewCount: 0,
    aiBrief: null,
  },
  "3": {
    id: "3",
    title: "Engineering Manager",
    state: "Reviewing",
    jobSummary:
      "Looking for an Engineering Manager to lead a team of 8-12 engineers. Requires strong technical background combined with people management skills.",
    rankingCriteria: [
      { category: "Leadership", label: "Team management (8+ reports)", priority: "High" },
      { category: "Experience", label: "Engineering management experience", priority: "High" },
      { category: "Skill Match", label: "Technical architecture skills", priority: "Medium" },
      { category: "Experience", label: "Agile/Scrum experience", priority: "Medium" },
    ],
    totalCandidates: 18,
    resumeCount: 18,
    interviewCount: 3,
    aiBrief: {
      totalCandidates: 18,
      scoreDistribution:
        "2 candidates scored 90+, 6 candidates scored 75–89, 5 candidates scored 60–74, 5 candidates scored below 60.",
      topHighlights: [
        "David Kim — 94/100 — 6 years EM experience, scaled team from 4 to 15 at Datadog",
        "Lisa Nguyen — 91/100 — Strong technical background, managed platform team at Shopify",
        "James Chen — 88/100 — Transitioned from principal engineer, strong mentoring skills",
      ],
      patterns: [
        "Top candidates all have experience growing teams significantly",
        "Candidates with both IC and management experience score higher",
        "Most applicants come from Series B-D companies",
      ],
      recommendedAction:
        "Move top 2 candidates to interview stage. The top 6 in the 75–89 tier should undergo a leadership case-study exercise.",
    },
  },
};

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");

  // Get project data (mock for now, API in task 20)
  const project = mockProjects[params.id] ?? mockProjects["1"];

  return (
    <div className="space-y-6">
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
        <LifecycleBadge state={project.state} />
      </div>

      {/* Tab navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab
          projectTitle={project.title}
          jobSummary={project.jobSummary}
          rankingCriteria={project.rankingCriteria}
          resumeCount={project.resumeCount}
          interviewCount={project.interviewCount}
          totalCandidates={project.totalCandidates}
          aiBriefData={project.aiBrief}
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
  );
}
