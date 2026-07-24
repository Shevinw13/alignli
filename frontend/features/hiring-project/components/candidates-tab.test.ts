/**
 * Unit tests for Candidates tab logic.
 *
 * Tests filtering, sorting, pagination, score color coding,
 * summary truncation, and empty state behavior.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8
 */

import { describe, it, expect } from "vitest";
import { scoreColor, type ScoreColor } from "../../../lib/utils/score-color";

// --- Types (mirror component internals) ---

type ConfidenceLevel = "High" | "Medium" | "Low";

interface CandidateCardData {
  id: string;
  name: string;
  currentCompany: string | null;
  location: string | null;
  yearsExperience: number | null;
  matchScore: number | null;
  confidenceLevel: ConfidenceLevel | null;
  summary: string | null;
}

interface FilterState {
  minScore: string;
  maxScore: string;
  confidenceLevel: "" | ConfidenceLevel;
}

// --- Logic extracted from component ---

const PAGE_SIZE = 50;

function filterAndSortCandidates(
  candidates: CandidateCardData[],
  filters: FilterState
): CandidateCardData[] {
  let result = [...candidates];

  const minScore = filters.minScore ? parseInt(filters.minScore, 10) : null;
  const maxScore = filters.maxScore ? parseInt(filters.maxScore, 10) : null;

  if (minScore !== null && !isNaN(minScore)) {
    result = result.filter(
      (c) => c.matchScore !== null && c.matchScore >= minScore
    );
  }

  if (maxScore !== null && !isNaN(maxScore)) {
    result = result.filter(
      (c) => c.matchScore !== null && c.matchScore <= maxScore
    );
  }

  if (filters.confidenceLevel) {
    result = result.filter(
      (c) => c.confidenceLevel === filters.confidenceLevel
    );
  }

  // Sort by match score descending
  result.sort((a, b) => {
    const scoreA = a.matchScore ?? -1;
    const scoreB = b.matchScore ?? -1;
    return scoreB - scoreA;
  });

  return result;
}

function paginate(items: CandidateCardData[], page: number): CandidateCardData[] {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

function getTotalPages(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

function truncateSummary(summary: string | null): string | null {
  if (!summary) return null;
  return summary.length > 150 ? summary.slice(0, 147) + "..." : summary;
}

// --- Test Data ---

function createCandidate(overrides: Partial<CandidateCardData> = {}): CandidateCardData {
  return {
    id: overrides.id ?? "cand-1",
    name: overrides.name ?? "Test Candidate",
    currentCompany: overrides.currentCompany ?? "TestCorp",
    location: overrides.location ?? "New York, NY",
    yearsExperience: overrides.yearsExperience ?? 5,
    matchScore: overrides.matchScore ?? 80,
    confidenceLevel: overrides.confidenceLevel ?? "High",
    summary: overrides.summary ?? "A skilled candidate.",
    ...overrides,
  };
}

// --- Tests ---

describe("Candidates Tab - Sort Order (Req 10.1)", () => {
  it("sorts candidates by Match_Score descending", () => {
    const candidates = [
      createCandidate({ id: "c1", matchScore: 65 }),
      createCandidate({ id: "c2", matchScore: 97 }),
      createCandidate({ id: "c3", matchScore: 80 }),
    ];

    const sorted = filterAndSortCandidates(candidates, {
      minScore: "",
      maxScore: "",
      confidenceLevel: "",
    });

    expect(sorted[0].matchScore).toBe(97);
    expect(sorted[1].matchScore).toBe(80);
    expect(sorted[2].matchScore).toBe(65);
  });

  it("places candidates with null score at the end", () => {
    const candidates = [
      createCandidate({ id: "c1", matchScore: null }),
      createCandidate({ id: "c2", matchScore: 50 }),
      createCandidate({ id: "c3", matchScore: 90 }),
    ];

    const sorted = filterAndSortCandidates(candidates, {
      minScore: "",
      maxScore: "",
      confidenceLevel: "",
    });

    expect(sorted[0].matchScore).toBe(90);
    expect(sorted[1].matchScore).toBe(50);
    expect(sorted[2].matchScore).toBe(null);
  });
});

describe("Candidates Tab - Score Color Coding (Req 10.3)", () => {
  it("returns green for scores 95-100", () => {
    expect(scoreColor(95)).toBe("green");
    expect(scoreColor(100)).toBe("green");
    expect(scoreColor(97)).toBe("green");
  });

  it("returns blue for scores 80-94", () => {
    expect(scoreColor(80)).toBe("blue");
    expect(scoreColor(94)).toBe("blue");
    expect(scoreColor(87)).toBe("blue");
  });

  it("returns amber for scores 65-79", () => {
    expect(scoreColor(65)).toBe("amber");
    expect(scoreColor(79)).toBe("amber");
    expect(scoreColor(72)).toBe("amber");
  });

  it("returns gray for scores 0-64", () => {
    expect(scoreColor(0)).toBe("gray");
    expect(scoreColor(64)).toBe("gray");
    expect(scoreColor(30)).toBe("gray");
  });

  it("has no gaps between ranges - boundary values", () => {
    // 64 is gray, 65 is amber
    expect(scoreColor(64)).toBe("gray");
    expect(scoreColor(65)).toBe("amber");
    // 79 is amber, 80 is blue
    expect(scoreColor(79)).toBe("amber");
    expect(scoreColor(80)).toBe("blue");
    // 94 is blue, 95 is green
    expect(scoreColor(94)).toBe("blue");
    expect(scoreColor(95)).toBe("green");
  });
});

describe("Candidates Tab - Filtering (Req 10.7)", () => {
  const candidates = [
    createCandidate({ id: "c1", matchScore: 97, confidenceLevel: "High" }),
    createCandidate({ id: "c2", matchScore: 85, confidenceLevel: "Medium" }),
    createCandidate({ id: "c3", matchScore: 72, confidenceLevel: "High" }),
    createCandidate({ id: "c4", matchScore: 55, confidenceLevel: "Low" }),
    createCandidate({ id: "c5", matchScore: 40, confidenceLevel: "Low" }),
  ];

  it("filters by minimum score", () => {
    const filtered = filterAndSortCandidates(candidates, {
      minScore: "70",
      maxScore: "",
      confidenceLevel: "",
    });

    expect(filtered).toHaveLength(3);
    expect(filtered.every((c) => c.matchScore! >= 70)).toBe(true);
  });

  it("filters by maximum score", () => {
    const filtered = filterAndSortCandidates(candidates, {
      minScore: "",
      maxScore: "80",
      confidenceLevel: "",
    });

    expect(filtered).toHaveLength(3);
    expect(filtered.every((c) => c.matchScore! <= 80)).toBe(true);
  });

  it("filters by score range (min and max)", () => {
    const filtered = filterAndSortCandidates(candidates, {
      minScore: "50",
      maxScore: "90",
      confidenceLevel: "",
    });

    expect(filtered).toHaveLength(3);
    expect(filtered.every((c) => c.matchScore! >= 50 && c.matchScore! <= 90)).toBe(true);
  });

  it("filters by confidence level", () => {
    const filtered = filterAndSortCandidates(candidates, {
      minScore: "",
      maxScore: "",
      confidenceLevel: "High",
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.every((c) => c.confidenceLevel === "High")).toBe(true);
  });

  it("combines score and confidence filters", () => {
    const filtered = filterAndSortCandidates(candidates, {
      minScore: "80",
      maxScore: "",
      confidenceLevel: "High",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("c1");
  });

  it("returns empty array when no candidates match filters", () => {
    const filtered = filterAndSortCandidates(candidates, {
      minScore: "99",
      maxScore: "",
      confidenceLevel: "",
    });

    expect(filtered).toHaveLength(0);
  });
});

describe("Candidates Tab - Pagination (Req 10.6)", () => {
  it("page size is 50", () => {
    expect(PAGE_SIZE).toBe(50);
  });

  it("calculates correct total pages for items exceeding page size", () => {
    expect(getTotalPages(100)).toBe(2);
    expect(getTotalPages(51)).toBe(2);
    expect(getTotalPages(50)).toBe(1);
    expect(getTotalPages(49)).toBe(1);
    expect(getTotalPages(150)).toBe(3);
  });

  it("returns minimum 1 page for empty list", () => {
    expect(getTotalPages(0)).toBe(1);
  });

  it("returns correct page of results", () => {
    const candidates = Array.from({ length: 75 }, (_, i) =>
      createCandidate({ id: `c${i}`, matchScore: 100 - i })
    );

    const page1 = paginate(candidates, 1);
    const page2 = paginate(candidates, 2);

    expect(page1).toHaveLength(50);
    expect(page2).toHaveLength(25);
    expect(page1[0].id).toBe("c0");
    expect(page2[0].id).toBe("c50");
  });
});

describe("Candidates Tab - Summary Truncation (Req 10.2)", () => {
  it("keeps summary as-is when ≤150 chars", () => {
    const summary = "A".repeat(150);
    expect(truncateSummary(summary)).toBe(summary);
  });

  it("truncates summary to 150 chars with ellipsis when exceeding", () => {
    const summary = "A".repeat(200);
    const result = truncateSummary(summary)!;
    expect(result.length).toBe(150);
    expect(result.endsWith("...")).toBe(true);
  });

  it("returns null for null summary", () => {
    expect(truncateSummary(null)).toBe(null);
  });
});

describe("Candidates Tab - Empty State (Req 10.8)", () => {
  it("returns empty when filters exclude all candidates", () => {
    const candidates = [
      createCandidate({ id: "c1", matchScore: 50 }),
      createCandidate({ id: "c2", matchScore: 60 }),
    ];

    const filtered = filterAndSortCandidates(candidates, {
      minScore: "90",
      maxScore: "",
      confidenceLevel: "",
    });

    expect(filtered).toHaveLength(0);
  });

  it("returns empty when confidence filter excludes all", () => {
    const candidates = [
      createCandidate({ id: "c1", confidenceLevel: "High" }),
      createCandidate({ id: "c2", confidenceLevel: "High" }),
    ];

    const filtered = filterAndSortCandidates(candidates, {
      minScore: "",
      maxScore: "",
      confidenceLevel: "Low",
    });

    expect(filtered).toHaveLength(0);
  });
});
