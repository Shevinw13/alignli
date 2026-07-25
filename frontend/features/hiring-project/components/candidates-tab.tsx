"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Search, Upload } from "lucide-react";
import { CandidateCard, type CandidateCardData, type ConfidenceLevel } from "./candidate-card";

// --- Types ---

interface FilterState {
  minScore: string;
  maxScore: string;
  confidenceLevel: "" | ConfidenceLevel;
}

// --- Mock Data ---

const MOCK_CANDIDATES: CandidateCardData[] = [
  {
    id: "cand-1",
    name: "Alice Johnson",
    currentCompany: "TechCorp Inc.",
    location: "San Francisco, CA",
    yearsExperience: 8,
    matchScore: 97,
    confidenceLevel: "High",
    summary: "Exceptional full-stack engineer with deep expertise in React and Node.js. Led migration of monolith to microservices serving 2M users.",
  },
  {
    id: "cand-2",
    name: "Bob Williams",
    currentCompany: "DataFlow Systems",
    location: "New York, NY",
    yearsExperience: 6,
    matchScore: 91,
    confidenceLevel: "High",
    summary: "Strong backend developer with excellent system design skills. Built real-time data pipelines processing 500K events per second.",
  },
  {
    id: "cand-3",
    name: "Carlos Martinez",
    currentCompany: "StartupXYZ",
    location: "Austin, TX",
    yearsExperience: 4,
    matchScore: 84,
    confidenceLevel: "Medium",
    summary: "Promising mid-level engineer with rapid growth trajectory. Strong TypeScript skills and experience with cloud infrastructure.",
  },
  {
    id: "cand-4",
    name: "Diana Chen",
    currentCompany: "GlobalFinance Ltd.",
    location: "Seattle, WA",
    yearsExperience: 10,
    matchScore: 78,
    confidenceLevel: "High",
    summary: "Experienced technical lead with fintech domain expertise. Managed teams of 12+ engineers delivering compliance-critical systems.",
  },
  {
    id: "cand-5",
    name: "Erik Johansson",
    currentCompany: "Nordic Solutions",
    location: "Remote",
    yearsExperience: 5,
    matchScore: 72,
    confidenceLevel: "Medium",
    summary: "Solid mid-level developer with strong focus on code quality and testing. Experience with distributed systems and event-driven architecture.",
  },
  {
    id: "cand-6",
    name: "Fatima Al-Rashid",
    currentCompany: null,
    location: "Chicago, IL",
    yearsExperience: 3,
    matchScore: 65,
    confidenceLevel: "Low",
    summary: "Junior developer with strong academic background and internship experience at FAANG company. Passionate about AI/ML applications.",
  },
  {
    id: "cand-7",
    name: "George Okafor",
    currentCompany: "MedTech Solutions",
    location: "Boston, MA",
    yearsExperience: 7,
    matchScore: 60,
    confidenceLevel: "Medium",
    summary: "Healthcare-focused developer with experience in HIPAA-compliant systems. Skills slightly misaligned with current role requirements.",
  },
  {
    id: "cand-8",
    name: "Hannah Kim",
    currentCompany: "Creative Agency",
    location: "Los Angeles, CA",
    yearsExperience: 2,
    matchScore: 45,
    confidenceLevel: "Low",
    summary: "Early-career frontend developer with design background. Limited backend experience but strong UI/UX sensibility.",
  },
];

// --- Constants ---

const PAGE_SIZE = 50;

// --- Filter Bar ---

function FilterBar({
  filters,
  onFiltersChange,
  resultCount,
}: {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  resultCount: number;
}) {
  return (
    <div
      className="flex flex-wrap items-end gap-4 rounded-[12px] border border-border bg-white p-4"
      role="search"
      aria-label="Candidate filters"
    >
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-navy">Filters</span>
      </div>

      {/* Min score */}
      <div className="space-y-1">
        <label htmlFor="min-score" className="block text-xs font-medium text-muted-foreground">
          Min Score
        </label>
        <input
          id="min-score"
          type="number"
          min={0}
          max={100}
          placeholder="0"
          value={filters.minScore}
          onChange={(e) => onFiltersChange({ ...filters, minScore: e.target.value })}
          className={cn(
            "w-20 rounded-[8px] border border-border px-2.5 py-1.5 text-sm text-navy outline-none transition-colors",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
          )}
        />
      </div>

      {/* Max score */}
      <div className="space-y-1">
        <label htmlFor="max-score" className="block text-xs font-medium text-muted-foreground">
          Max Score
        </label>
        <input
          id="max-score"
          type="number"
          min={0}
          max={100}
          placeholder="100"
          value={filters.maxScore}
          onChange={(e) => onFiltersChange({ ...filters, maxScore: e.target.value })}
          className={cn(
            "w-20 rounded-[8px] border border-border px-2.5 py-1.5 text-sm text-navy outline-none transition-colors",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
          )}
        />
      </div>

      {/* Confidence level */}
      <div className="space-y-1">
        <label htmlFor="confidence-filter" className="block text-xs font-medium text-muted-foreground">
          Confidence
        </label>
        <select
          id="confidence-filter"
          value={filters.confidenceLevel}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              confidenceLevel: e.target.value as FilterState["confidenceLevel"],
            })
          }
          className={cn(
            "rounded-[8px] border border-border px-2.5 py-1.5 text-sm text-navy outline-none transition-colors appearance-none bg-white pr-7",
            "focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20",
            !filters.confidenceLevel && "text-muted-foreground"
          )}
        >
          <option value="">All</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Results count */}
      <div className="flex items-center">
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-navy">{resultCount}</span> result{resultCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Clear filters */}
      {(filters.minScore || filters.maxScore || filters.confidenceLevel) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-[8px] px-3 text-xs text-muted-foreground hover:text-navy"
          onClick={() =>
            onFiltersChange({ minScore: "", maxScore: "", confidenceLevel: "" })
          }
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}

// --- Pagination ---

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      className="flex items-center justify-center gap-3 rounded-[12px] border border-border bg-white px-4 py-3"
      aria-label="Candidates pagination"
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 rounded-[8px] px-3 text-sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Previous
      </Button>

      <span className="text-sm text-muted-foreground">
        Page <span className="font-medium text-navy">{currentPage}</span> of{" "}
        <span className="font-medium text-navy">{totalPages}</span>
      </span>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 rounded-[8px] px-3 text-sm"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}

// --- Empty State ---

// (Using shared EmptyState from @/components/ui/empty-state)

// --- Main Component ---

/**
 * Candidates tab — displays ranked candidate cards with filtering and pagination.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8
 */
export function CandidatesTab() {
  const [filters, setFilters] = useState<FilterState>({
    minScore: "",
    maxScore: "",
    confidenceLevel: "",
  });
  const [currentPage, setCurrentPage] = useState(1);

  // Filter and sort candidates
  const filteredCandidates = useMemo(() => {
    let candidates = [...MOCK_CANDIDATES];

    // Apply score filters
    const minScore = filters.minScore ? parseInt(filters.minScore, 10) : null;
    const maxScore = filters.maxScore ? parseInt(filters.maxScore, 10) : null;

    if (minScore !== null && !isNaN(minScore)) {
      candidates = candidates.filter(
        (c) => c.matchScore !== null && c.matchScore >= minScore
      );
    }

    if (maxScore !== null && !isNaN(maxScore)) {
      candidates = candidates.filter(
        (c) => c.matchScore !== null && c.matchScore <= maxScore
      );
    }

    // Apply confidence filter
    if (filters.confidenceLevel) {
      candidates = candidates.filter(
        (c) => c.confidenceLevel === filters.confidenceLevel
      );
    }

    // Sort by match score descending (Requirement 10.1)
    candidates.sort((a, b) => {
      const scoreA = a.matchScore ?? -1;
      const scoreB = b.matchScore ?? -1;
      return scoreB - scoreA;
    });

    return candidates;
  }, [filters]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / PAGE_SIZE));
  const paginatedCandidates = filteredCandidates.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset to page 1 when filters change
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const hasActiveFilters =
    filters.minScore !== "" ||
    filters.maxScore !== "" ||
    filters.confidenceLevel !== "";

  return (
    <div className="space-y-4">
      {/* Filter bar with results count */}
      <FilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        resultCount={filteredCandidates.length}
      />

      {/* Results */}
      {paginatedCandidates.length === 0 ? (
        hasActiveFilters ? (
          <div className="rounded-[16px] border border-border bg-white">
            <EmptyState
              icon={Search}
              title="No results match"
              description="No candidates match the current filter criteria. Try adjusting your score range or confidence level."
              secondaryLabel="Clear filters"
              onSecondaryAction={() =>
                handleFiltersChange({ minScore: "", maxScore: "", confidenceLevel: "" })
              }
            />
          </div>
        ) : (
          <div className="rounded-[16px] border border-border bg-white">
            <EmptyState
              icon={Upload}
              title="No candidates yet"
              description="Upload resumes to get started evaluating candidates for this role."
              actionLabel="Upload resumes"
              onAction={() => {
                /* Will be wired to resume upload in task 20 */
              }}
            />
          </div>
        )
      ) : (
        <div className="space-y-3" role="list" aria-label="Candidate list">
          {paginatedCandidates.map((candidate) => (
            <div key={candidate.id} role="listitem">
              <CandidateCard candidate={candidate} />
            </div>
          ))}
        </div>
      )}

      {/* Pagination: Previous / Page X of Y / Next */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
