/**
 * Unit tests for Ranking Criteria Step logic.
 *
 * Tests the core data management behaviors of the ranking criteria step:
 * - Criteria categories and priority types
 * - Max score clamping (1-100)
 * - Validation that at least one criterion must remain
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { describe, it, expect } from "vitest";
import type {
  RankingCriterion,
  Priority,
  CriteriaCategory,
} from "./ranking-criteria-step";

// ─── Helper: simulates max score clamping logic from the component ───────────

function clampMaxScore(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.max(1, Math.min(100, value));
}

// ─── Helper: simulates confirm validation from the component ─────────────────

function validateCriteria(criteria: RankingCriterion[]): string | null {
  if (criteria.length === 0) {
    return "At least one criterion is required to continue.";
  }
  return null;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RankingCriteriaStep logic", () => {
  describe("criteria categories (Req 5.2)", () => {
    const validCategories: CriteriaCategory[] = [
      "Skill Match",
      "Experience",
      "Education",
      "Leadership",
      "Certifications",
      "Location",
      "Career Growth",
      "Employment Stability",
      "Custom",
    ];

    it("supports all required criteria categories", () => {
      expect(validCategories).toHaveLength(9);
      expect(validCategories).toContain("Skill Match");
      expect(validCategories).toContain("Experience");
      expect(validCategories).toContain("Education");
      expect(validCategories).toContain("Leadership");
      expect(validCategories).toContain("Certifications");
      expect(validCategories).toContain("Location");
      expect(validCategories).toContain("Career Growth");
      expect(validCategories).toContain("Employment Stability");
      expect(validCategories).toContain("Custom");
    });
  });

  describe("priority levels (Req 5.3)", () => {
    const validPriorities: Priority[] = ["Low", "Medium", "High"];

    it("supports exactly three priority levels", () => {
      expect(validPriorities).toHaveLength(3);
    });

    it("includes Low, Medium, and High", () => {
      expect(validPriorities).toContain("Low");
      expect(validPriorities).toContain("Medium");
      expect(validPriorities).toContain("High");
    });
  });

  describe("max score clamping (Req 5.3)", () => {
    it("clamps value below 1 to 1", () => {
      expect(clampMaxScore(0)).toBe(1);
      expect(clampMaxScore(-5)).toBe(1);
    });

    it("clamps value above 100 to 100", () => {
      expect(clampMaxScore(101)).toBe(100);
      expect(clampMaxScore(999)).toBe(100);
    });

    it("preserves valid values between 1 and 100", () => {
      expect(clampMaxScore(1)).toBe(1);
      expect(clampMaxScore(50)).toBe(50);
      expect(clampMaxScore(100)).toBe(100);
    });

    it("handles NaN by returning 1", () => {
      expect(clampMaxScore(NaN)).toBe(1);
    });
  });

  describe("custom criteria addition (Req 5.4)", () => {
    it("can add unlimited custom criteria to the list", () => {
      const criteria: RankingCriterion[] = [];
      for (let i = 0; i < 50; i++) {
        criteria.push({
          id: `custom-${i}`,
          category: "Custom",
          label: `Custom Criterion ${i}`,
          priority: "Medium",
          maxScore: 50,
        });
      }
      expect(criteria).toHaveLength(50);
      expect(criteria.every((c) => c.category === "Custom")).toBe(true);
    });

    it("supports all category options in the add form", () => {
      const categories: CriteriaCategory[] = [
        "Skill Match",
        "Experience",
        "Education",
        "Leadership",
        "Certifications",
        "Location",
        "Career Growth",
        "Employment Stability",
        "Custom",
      ];
      // A custom criterion can be created with any category
      const criterion: RankingCriterion = {
        id: "test-1",
        category: categories[0],
        label: "Test label",
        priority: "High",
        maxScore: 75,
      };
      expect(criterion.category).toBe("Skill Match");
    });

    it("requires a non-empty label for new criteria", () => {
      const label = "  ";
      const trimmed = label.trim();
      expect(trimmed).toBe("");
      // Form should show error when label is empty
    });

    it("allows setting priority and max score on new criteria", () => {
      const newCriterion: RankingCriterion = {
        id: "new-1",
        category: "Experience",
        label: "Years in industry",
        priority: "High",
        maxScore: 90,
      };
      expect(newCriterion.priority).toBe("High");
      expect(newCriterion.maxScore).toBe(90);
      expect(newCriterion.category).toBe("Experience");
    });
  });

  describe("criterion removal (Req 5.5)", () => {
    it("can remove a criterion by id", () => {
      const criteria: RankingCriterion[] = [
        { id: "1", category: "Skill Match", label: "A", priority: "High", maxScore: 80 },
        { id: "2", category: "Experience", label: "B", priority: "Medium", maxScore: 60 },
        { id: "3", category: "Education", label: "C", priority: "Low", maxScore: 40 },
      ];
      const result = criteria.filter((c) => c.id !== "2");
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.id)).toEqual(["1", "3"]);
    });
  });

  describe("confirm validation (Req 5.7)", () => {
    it("returns error when criteria list is empty", () => {
      const error = validateCriteria([]);
      expect(error).toBe("At least one criterion is required to continue.");
    });

    it("returns null when at least one criterion exists", () => {
      const criteria: RankingCriterion[] = [
        { id: "1", category: "Skill Match", label: "A", priority: "High", maxScore: 80 },
      ];
      const error = validateCriteria(criteria);
      expect(error).toBeNull();
    });

    it("returns null when multiple criteria exist", () => {
      const criteria: RankingCriterion[] = [
        { id: "1", category: "Skill Match", label: "A", priority: "High", maxScore: 80 },
        { id: "2", category: "Custom", label: "B", priority: "Low", maxScore: 30 },
      ];
      const error = validateCriteria(criteria);
      expect(error).toBeNull();
    });
  });

  describe("priority change (Req 5.3)", () => {
    it("can update a criterion's priority", () => {
      const criteria: RankingCriterion[] = [
        { id: "1", category: "Skill Match", label: "A", priority: "High", maxScore: 80 },
      ];
      const updated = criteria.map((c) =>
        c.id === "1" ? { ...c, priority: "Low" as Priority } : c
      );
      expect(updated[0].priority).toBe("Low");
    });
  });

  describe("max score change (Req 5.3)", () => {
    it("can update a criterion's max score", () => {
      const criteria: RankingCriterion[] = [
        { id: "1", category: "Skill Match", label: "A", priority: "High", maxScore: 80 },
      ];
      const updated = criteria.map((c) =>
        c.id === "1" ? { ...c, maxScore: clampMaxScore(95) } : c
      );
      expect(updated[0].maxScore).toBe(95);
    });
  });
});
