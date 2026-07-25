"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/shared";
import {
  ComparisonView,
  validateCandidateSelection,
  MIN_CANDIDATES,
  MAX_CANDIDATES,
  type ComparisonCandidate,
  type ComparisonSummaryData,
} from "@/features/comparison";

// ─── Mock data for comparison (will be replaced by API in task 20) ───────────

const MOCK_CANDIDATES: ComparisonCandidate[] = [
  {
    id: "c1",
    fullName: "Sarah Chen",
    currentCompany: "Stripe",
    location: "San Francisco, CA",
    matchScore: 96,
    confidenceLevel: "High",
    criterionScores: [
      {
        criterionId: "crit-1",
        category: "Skill Match",
        label: "React & TypeScript proficiency",
        rawScore: 95,
        maxScore: 100,
        reasoning:
          "8 years React, TypeScript expert, led frontend platform redesign",
      },
      {
        criterionId: "crit-2",
        category: "Experience",
        label: "5+ years frontend development",
        rawScore: 98,
        maxScore: 100,
        reasoning: "8 years of dedicated frontend engineering experience",
      },
      {
        criterionId: "crit-3",
        category: "Leadership",
        label: "Mentorship & code review experience",
        rawScore: 88,
        maxScore: 100,
        reasoning: "Led team of 4, extensive code review responsibilities",
      },
      {
        criterionId: "crit-4",
        category: "Education",
        label: "Computer Science or related field",
        rawScore: 90,
        maxScore: 100,
        reasoning: "MS Computer Science, Stanford University",
      },
      {
        criterionId: "crit-5",
        category: "Certifications",
        label: "AWS or cloud certifications",
        rawScore: 40,
        maxScore: 100,
        reasoning: "No formal cloud certifications listed",
      },
    ],
    dimensions: [
      { key: "experience", label: "Experience", value: "8 years frontend, 3 years as lead" },
      { key: "technical_skills", label: "Technical Skills", value: "React, TypeScript, Next.js, GraphQL, Node.js" },
      { key: "leadership", label: "Leadership", value: "Led frontend platform team of 4 engineers" },
      { key: "education", label: "Education", value: "MS Computer Science, Stanford" },
      { key: "projects", label: "Projects", value: "Payment UI redesign, Design System v2" },
      { key: "career_growth", label: "Career Growth", value: "IC → Senior → Lead in 5 years" },
      { key: "job_stability", label: "Job Stability", value: "3 years at Stripe, 2 years at Airbnb" },
      { key: "industry_knowledge", label: "Industry Knowledge", value: "Fintech, developer tools" },
      { key: "communication", label: "Communication", value: "Conference speaker, blog author" },
    ],
  },
  {
    id: "c2",
    fullName: "Marcus Johnson",
    currentCompany: "Meta",
    location: "New York, NY",
    matchScore: 93,
    confidenceLevel: "High",
    criterionScores: [
      {
        criterionId: "crit-1",
        category: "Skill Match",
        label: "React & TypeScript proficiency",
        rawScore: 92,
        maxScore: 100,
        reasoning:
          "6 years React, strong TypeScript, full-stack background adds depth",
      },
      {
        criterionId: "crit-2",
        category: "Experience",
        label: "5+ years frontend development",
        rawScore: 90,
        maxScore: 100,
        reasoning: "6 years frontend with additional backend experience",
      },
      {
        criterionId: "crit-3",
        category: "Leadership",
        label: "Mentorship & code review experience",
        rawScore: 85,
        maxScore: 100,
        reasoning: "Mentored 3 junior engineers, active in code reviews",
      },
      {
        criterionId: "crit-4",
        category: "Education",
        label: "Computer Science or related field",
        rawScore: 85,
        maxScore: 100,
        reasoning: "BS Computer Science, MIT",
      },
      {
        criterionId: "crit-5",
        category: "Certifications",
        label: "AWS or cloud certifications",
        rawScore: 70,
        maxScore: 100,
        reasoning: "AWS Solutions Architect Associate",
      },
    ],
    dimensions: [
      { key: "experience", label: "Experience", value: "6 years frontend, 2 years full-stack" },
      { key: "technical_skills", label: "Technical Skills", value: "React, TypeScript, Python, AWS, PostgreSQL" },
      { key: "leadership", label: "Leadership", value: "Mentored 3 junior engineers" },
      { key: "education", label: "Education", value: "BS Computer Science, MIT" },
      { key: "projects", label: "Projects", value: "Marketplace redesign, internal tooling platform" },
      { key: "career_growth", label: "Career Growth", value: "Junior → Senior in 4 years" },
      { key: "job_stability", label: "Job Stability", value: "4 years at Meta" },
      { key: "industry_knowledge", label: "Industry Knowledge", value: "Social media, marketplace" },
      { key: "communication", label: "Communication", value: null },
    ],
  },
  {
    id: "c3",
    fullName: "Priya Patel",
    currentCompany: "Vercel",
    location: "Remote",
    matchScore: 91,
    confidenceLevel: "High",
    criterionScores: [
      {
        criterionId: "crit-1",
        category: "Skill Match",
        label: "React & TypeScript proficiency",
        rawScore: 94,
        maxScore: 100,
        reasoning:
          "Open-source Next.js contributor, deep React internals knowledge",
      },
      {
        criterionId: "crit-2",
        category: "Experience",
        label: "5+ years frontend development",
        rawScore: 85,
        maxScore: 100,
        reasoning: "5 years frontend development experience",
      },
      {
        criterionId: "crit-3",
        category: "Leadership",
        label: "Mentorship & code review experience",
        rawScore: 78,
        maxScore: 100,
        reasoning: "Open-source maintainer, reviews community PRs",
      },
      {
        criterionId: "crit-4",
        category: "Education",
        label: "Computer Science or related field",
        rawScore: 70,
        maxScore: 100,
        reasoning: "Self-taught with bootcamp certificate",
      },
      {
        criterionId: "crit-5",
        category: "Certifications",
        label: "AWS or cloud certifications",
        rawScore: 0,
        maxScore: 100,
        reasoning: "Insufficient data for evaluation",
      },
    ],
    dimensions: [
      { key: "experience", label: "Experience", value: "5 years frontend" },
      { key: "technical_skills", label: "Technical Skills", value: "React, Next.js, TypeScript, Rust, Webpack" },
      { key: "leadership", label: "Leadership", value: "Open-source maintainer with 2k+ GitHub stars" },
      { key: "education", label: "Education", value: "Self-taught, Coding Bootcamp Certificate" },
      { key: "projects", label: "Projects", value: "Next.js core contributor, Turbopack experiments" },
      { key: "career_growth", label: "Career Growth", value: "Bootcamp → Senior in 5 years" },
      { key: "job_stability", label: "Job Stability", value: "2 years at Vercel, 3 years at startup" },
      { key: "industry_knowledge", label: "Industry Knowledge", value: null },
      { key: "communication", label: "Communication", value: "Active open-source community engagement" },
    ],
  },
];

const MOCK_SUMMARY: ComparisonSummaryData = {
  summary: `Sarah Chen ranks highest (96) due to her extensive 8-year React experience at Stripe and leadership of a frontend platform team — experience that directly maps to the senior technical leadership this role requires.

Marcus Johnson (93) differentiates through his full-stack background and AWS certification, giving him architectural breadth that Sarah and Priya lack. His 4-year tenure at Meta demonstrates stability in high-scale environments.

Priya Patel (91) brings exceptional open-source credibility as a Next.js core contributor. While her formal leadership experience is lighter than Sarah's, her technical depth in React internals and build tooling (Rust, Webpack) is unmatched. Her self-taught background and shorter experience history account for the score gap.

Key differentiator: Sarah's combination of technical skill AND proven team leadership at scale gives her the edge. Marcus offers the best risk/reward balance if full-stack versatility is valued. Priya is ideal if deep technical innovation matters most.`,
  generatedAt: "just now",
};

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CompareCandidatesPage() {
  const params = useParams<{ id: string }>();
  const [selectedIds, setSelectedIds] = useState<string[]>(
    MOCK_CANDIDATES.slice(0, 3).map((c) => c.id)
  );

  const selectedCandidates = useMemo(
    () => MOCK_CANDIDATES.filter((c) => selectedIds.includes(c.id)),
    [selectedIds]
  );

  const validation = useMemo(
    () => validateCandidateSelection(selectedIds),
    [selectedIds]
  );

  function toggleCandidate(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((cid) => cid !== id);
      }
      if (prev.length >= MAX_CANDIDATES) {
        return prev; // Enforce max limit
      }
      return [...prev, id];
    });
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb navigation */}
      <Breadcrumb
        items={[
          { label: "Projects", href: "/" },
          { label: "Project", href: `/projects/${params.id}` },
          { label: "Compare", href: `/projects/${params.id}/compare` },
        ]}
      />

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/projects/${params.id}`}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-[8px]",
              "text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            )}
            aria-label="Back to project"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-navy">
              Compare Candidates
            </h1>
            <p className="text-sm text-muted-foreground">
              Select {MIN_CANDIDATES}–{MAX_CANDIDATES} candidates to compare
              side by side
            </p>
          </div>
        </div>
      </div>

      {/* Candidate selection chips */}
      <section
        className="rounded-[16px] border border-border bg-white p-4"
        aria-labelledby="candidate-selection-heading"
      >
        <h2
          id="candidate-selection-heading"
          className="text-sm font-semibold text-navy mb-3"
        >
          Selected Candidates ({selectedIds.length}/{MAX_CANDIDATES})
        </h2>
        <div className="flex flex-wrap gap-2">
          {MOCK_CANDIDATES.map((candidate) => {
            const isSelected = selectedIds.includes(candidate.id);
            const isDisabled =
              !isSelected && selectedIds.length >= MAX_CANDIDATES;
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => toggleCandidate(candidate.id)}
                disabled={isDisabled}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                  isSelected
                    ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                    : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100",
                  isDisabled && "opacity-50 cursor-not-allowed"
                )}
                aria-pressed={isSelected}
                aria-label={`${isSelected ? "Remove" : "Add"} ${candidate.fullName} ${isSelected ? "from" : "to"} comparison`}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  )}
                >
                  {candidate.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                {candidate.fullName}
                <span className="text-xs text-muted-foreground">
                  ({candidate.matchScore})
                </span>
              </button>
            );
          })}
        </div>

        {/* Validation message */}
        {!validation.valid && (
          <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <span>
              {validation.error}
            </span>
          </div>
        )}
      </section>

      {/* Comparison view — only shown when valid selection */}
      {validation.valid && (
        <ComparisonView
          candidates={selectedCandidates}
          summaryData={MOCK_SUMMARY}
          summaryLoading={false}
        />
      )}
    </div>
  );
}
