/**
 * Unit tests for score color coding utility.
 *
 * Tests all boundary values, mid-range values, and invalid inputs.
 * Requirements: 10.3
 */

import { describe, it, expect } from "vitest";
import { scoreColor } from "./score-color";

describe("scoreColor", () => {
  describe("boundary values", () => {
    it("returns gray for score 0", () => {
      expect(scoreColor(0)).toBe("gray");
    });

    it("returns gray for score 64", () => {
      expect(scoreColor(64)).toBe("gray");
    });

    it("returns amber for score 65", () => {
      expect(scoreColor(65)).toBe("amber");
    });

    it("returns amber for score 79", () => {
      expect(scoreColor(79)).toBe("amber");
    });

    it("returns blue for score 80", () => {
      expect(scoreColor(80)).toBe("blue");
    });

    it("returns blue for score 94", () => {
      expect(scoreColor(94)).toBe("blue");
    });

    it("returns green for score 95", () => {
      expect(scoreColor(95)).toBe("green");
    });

    it("returns green for score 100", () => {
      expect(scoreColor(100)).toBe("green");
    });
  });

  describe("mid-range values", () => {
    it("returns gray for score 30", () => {
      expect(scoreColor(30)).toBe("gray");
    });

    it("returns gray for score 50", () => {
      expect(scoreColor(50)).toBe("gray");
    });

    it("returns amber for score 70", () => {
      expect(scoreColor(70)).toBe("amber");
    });

    it("returns blue for score 85", () => {
      expect(scoreColor(85)).toBe("blue");
    });

    it("returns green for score 98", () => {
      expect(scoreColor(98)).toBe("green");
    });
  });

  describe("invalid inputs", () => {
    it("throws for negative score", () => {
      expect(() => scoreColor(-1)).toThrow("must be between 0 and 100");
    });

    it("throws for score above 100", () => {
      expect(() => scoreColor(101)).toThrow("must be between 0 and 100");
    });

    it("throws for large negative score", () => {
      expect(() => scoreColor(-100)).toThrow("must be between 0 and 100");
    });

    it("throws for large positive score", () => {
      expect(() => scoreColor(200)).toThrow("must be between 0 and 100");
    });

    it("throws for float score", () => {
      expect(() => scoreColor(85.5)).toThrow("must be an integer");
    });

    it("throws for NaN", () => {
      expect(() => scoreColor(NaN)).toThrow("must be an integer");
    });

    it("throws for Infinity", () => {
      expect(() => scoreColor(Infinity)).toThrow("must be an integer");
    });
  });
});
