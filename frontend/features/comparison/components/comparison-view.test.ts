/**
 * Unit tests for Candidate Comparison view logic.
 *
 * Tests candidate selection validation, score color mapping,
 * unique criteria extraction, and dimension data handling.
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */

import { describe, it, expect } from "vitest";
import type {
  ComparisonCandidate,
  DimensionKey,
} from "./types";
import { ALL_DIMENSION_KEYS, DIMENSION_LABELS } from "./types";
import { validateCandidateSelection } from "../utils";

// ─── Score Color Mapping ─────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 95) return "text-emerald-600";
  if (score >= 80) return "text-blue-600";
  if (score >= 65) return "text-amber-600";
  return "text-gray-500";
}

function getScoreRingColor(score: number): string {
  if (score >= 95) return "stroke-emerald-500";
  if (score >= 80) return "stroke-blue-500";
  if (score >= 65) return "stroke-amber-500";
  return "stroke-gray-400";
}

function getScoreBarColor(score: number, maxScore: number): string {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 90) return "bg-emerald-500";
  if (pct >= 70) return "bg-blue-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-gray-400";
}

// ─── Unique Criteria Extraction ──────────────────────────────────────────────

function getUniqueCriteria(
  candidates: ComparisonCandidate[]
): { criterionId: string; label: string; category: string }[] {
  const seen = new Map<string, { label: string; category: string }>();
  for (const candidate of candidates) {
    for (const score of candidate.criterionScores) {
      if (!seen.has(score.criterionId)) {
        seen.set(score.criterionId, {
          label: score.label,
          category: score.category,
        });
      }
    }
  }
  return Array.from(seen.entries()).map(([id, meta]) => ({
    criterionId: id,
    ...meta,
  }));
}

// ─── Dimension Data Availability ─────────────────────────────────────────────

function getDimensionValue(
  candidate: ComparisonCandidate,
  key: DimensionKey
): string | null {
  const dimension = candidate.dimensions.find((d) => d.key === key);
  return dimension?.value ?? null;
}

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createMockCandidate(
  id: string,
  overrides?: Partial<ComparisonCandidate>
): ComparisonCandidate {
  return {
    id,
    fullName: `Candidate ${id}`,
    currentCompany: "Test Corp",
    location: "Remote",
    matchScore: 85,
    confidenceLevel: "High",
    criterionScores: [
      {
        criterionId: "crit-1",
        category: "Skill Match",
        label: "React proficiency",
        rawScore: 80,
        maxScore: 100,
        reasoning: "Strong React skills",
      },
    ],
    dimensions: ALL_DIMENSION_KEYS.map((key) => ({
      key,
      label: DIMENSION_LABELS[key],
      value: `${DIMENSION_LABELS[key]} data for ${id}`,
    })),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Comparison View - Candidate Selection Validation", () => {
  it("rejects fewer than 2 candidates", () => {
    const result = validateCandidateSelection(["c1"]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("at least 2");
  });

  it("rejects empty selection", () => {
    const result = validateCandidateSelection([]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("at least 2");
  });

  it("accepts exactly 2 candidates", () => {
    const result = validateCandidateSelection(["c1", "c2"]);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts exactly 3 candidates", () => {
    const result = validateCandidateSelection(["c1", "c2", "c3"]);
    expect(result.valid).toBe(true);
  });

  it("accepts exactly 4 candidates", () => {
    const result = validateCandidateSelection(["c1", "c2", "c3", "c4"]);
    expect(result.valid).toBe(true);
  });

  it("rejects more than 4 candidates", () => {
    const result = validateCandidateSelection([
      "c1",
      "c2",
      "c3",
      "c4",
      "c5",
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("at most 4");
  });
});

describe("Comparison View - Score Color Mapping", () => {
  it("returns emerald for scores >= 95", () => {
    expect(getScoreColor(95)).toBe("text-emerald-600");
    expect(getScoreColor(100)).toBe("text-emerald-600");
  });

  it("returns blue for scores 80–94", () => {
    expect(getScoreColor(80)).toBe("text-blue-600");
    expect(getScoreColor(94)).toBe("text-blue-600");
  });

  it("returns amber for scores 65–79", () => {
    expect(getScoreColor(65)).toBe("text-amber-600");
    expect(getScoreColor(79)).toBe("text-amber-600");
  });

  it("returns gray for scores below 65", () => {
    expect(getScoreColor(64)).toBe("text-gray-500");
    expect(getScoreColor(0)).toBe("text-gray-500");
  });

  it("returns matching ring colors for score thresholds", () => {
    expect(getScoreRingColor(95)).toBe("stroke-emerald-500");
    expect(getScoreRingColor(80)).toBe("stroke-blue-500");
    expect(getScoreRingColor(65)).toBe("stroke-amber-500");
    expect(getScoreRingColor(50)).toBe("stroke-gray-400");
  });
});

describe("Comparison View - Score Bar Color", () => {
  it("returns emerald for 90%+ score ratio", () => {
    expect(getScoreBarColor(90, 100)).toBe("bg-emerald-500");
    expect(getScoreBarColor(95, 100)).toBe("bg-emerald-500");
  });

  it("returns blue for 70–89% score ratio", () => {
    expect(getScoreBarColor(70, 100)).toBe("bg-blue-500");
    expect(getScoreBarColor(89, 100)).toBe("bg-blue-500");
  });

  it("returns amber for 50–69% score ratio", () => {
    expect(getScoreBarColor(50, 100)).toBe("bg-amber-500");
    expect(getScoreBarColor(69, 100)).toBe("bg-amber-500");
  });

  it("returns gray for below 50% score ratio", () => {
    expect(getScoreBarColor(49, 100)).toBe("bg-gray-400");
    expect(getScoreBarColor(0, 100)).toBe("bg-gray-400");
  });

  it("handles maxScore of 0 gracefully", () => {
    expect(getScoreBarColor(50, 0)).toBe("bg-gray-400");
  });
});

describe("Comparison View - Unique Criteria Extraction", () => {
  it("extracts criteria from a single candidate", () => {
    const candidate = createMockCandidate("c1");
    const criteria = getUniqueCriteria([candidate]);
    expect(criteria).toHaveLength(1);
    expect(criteria[0].criterionId).toBe("crit-1");
    expect(criteria[0].label).toBe("React proficiency");
    expect(criteria[0].category).toBe("Skill Match");
  });

  it("de-duplicates criteria shared across candidates", () => {
    const c1 = createMockCandidate("c1");
    const c2 = createMockCandidate("c2");
    const criteria = getUniqueCriteria([c1, c2]);
    // Both share crit-1
    expect(criteria).toHaveLength(1);
  });

  it("collects unique criteria from candidates with different criteria", () => {
    const c1 = createMockCandidate("c1", {
      criterionScores: [
        {
          criterionId: "crit-1",
          category: "Skill Match",
          label: "React",
          rawScore: 80,
          maxScore: 100,
          reasoning: "Good",
        },
      ],
    });
    const c2 = createMockCandidate("c2", {
      criterionScores: [
        {
          criterionId: "crit-2",
          category: "Experience",
          label: "5+ years",
          rawScore: 90,
          maxScore: 100,
          reasoning: "Strong",
        },
      ],
    });
    const criteria = getUniqueCriteria([c1, c2]);
    expect(criteria).toHaveLength(2);
    expect(criteria.map((c) => c.criterionId)).toContain("crit-1");
    expect(criteria.map((c) => c.criterionId)).toContain("crit-2");
  });

  it("returns empty array for candidates with no criteria", () => {
    const c1 = createMockCandidate("c1", { criterionScores: [] });
    const criteria = getUniqueCriteria([c1]);
    expect(criteria).toHaveLength(0);
  });

  it("returns empty array for empty candidate list", () => {
    const criteria = getUniqueCriteria([]);
    expect(criteria).toHaveLength(0);
  });
});

describe("Comparison View - Dimension Data Availability", () => {
  it("returns value for available dimension", () => {
    const candidate = createMockCandidate("c1");
    const value = getDimensionValue(candidate, "experience");
    expect(value).toBe("Experience data for c1");
  });

  it("returns null for dimension with null value", () => {
    const candidate = createMockCandidate("c1", {
      dimensions: [
        { key: "experience", label: "Experience", value: null },
        ...ALL_DIMENSION_KEYS.filter((k) => k !== "experience").map((key) => ({
          key: key as DimensionKey,
          label: DIMENSION_LABELS[key],
          value: "some value",
        })),
      ],
    });
    const value = getDimensionValue(candidate, "experience");
    expect(value).toBeNull();
  });

  it("returns null for dimension not in candidate data", () => {
    const candidate = createMockCandidate("c1", { dimensions: [] });
    const value = getDimensionValue(candidate, "leadership");
    expect(value).toBeNull();
  });
});

describe("Comparison View - Dimension Coverage", () => {
  it("defines all 9 required comparison dimensions", () => {
    expect(ALL_DIMENSION_KEYS).toHaveLength(9);
    expect(ALL_DIMENSION_KEYS).toContain("experience");
    expect(ALL_DIMENSION_KEYS).toContain("technical_skills");
    expect(ALL_DIMENSION_KEYS).toContain("leadership");
    expect(ALL_DIMENSION_KEYS).toContain("education");
    expect(ALL_DIMENSION_KEYS).toContain("projects");
    expect(ALL_DIMENSION_KEYS).toContain("career_growth");
    expect(ALL_DIMENSION_KEYS).toContain("job_stability");
    expect(ALL_DIMENSION_KEYS).toContain("industry_knowledge");
    expect(ALL_DIMENSION_KEYS).toContain("communication");
  });

  it("has labels for all dimension keys", () => {
    for (const key of ALL_DIMENSION_KEYS) {
      expect(DIMENSION_LABELS[key]).toBeDefined();
      expect(DIMENSION_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});
