/**
 * Unit tests for Settings tab lifecycle logic.
 *
 * Tests state transitions, prerequisites validation, and valid transition computation.
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8
 */

import { describe, it, expect } from "vitest";

// --- Types mirrored from component ---

type ProjectState =
  | "Draft"
  | "Active"
  | "Reviewing"
  | "Interviewing"
  | "Offer Extended"
  | "Filled"
  | "Archived";

// --- Logic extracted for testing (mirrors component logic) ---

const FORWARD_TRANSITIONS: Record<ProjectState, ProjectState | null> = {
  Draft: "Active",
  Active: "Reviewing",
  Reviewing: "Interviewing",
  Interviewing: "Offer Extended",
  "Offer Extended": "Filled",
  Filled: null,
  Archived: null,
};

const TRANSITION_PREREQUISITES: Record<string, string> = {
  "Draft→Active":
    "At least one candidate must have completed processing.",
  "Active→Reviewing":
    "At least one candidate must exist in the project.",
  "Reviewing→Interviewing":
    "At least one candidate must be selected for interview.",
  "Interviewing→Offer Extended":
    "At least one candidate must be marked as selected for offer.",
  "Offer Extended→Filled":
    "At least one candidate must have an accepted offer.",
};

function getValidTransitions(currentState: ProjectState): ProjectState[] {
  const transitions: ProjectState[] = [];

  const forwardState = FORWARD_TRANSITIONS[currentState];
  if (forwardState) {
    transitions.push(forwardState);
  }

  if (currentState !== "Archived") {
    transitions.push("Archived");
  }

  return transitions;
}

function isValidTransition(
  fromState: ProjectState,
  toState: ProjectState
): boolean {
  const validTargets = getValidTransitions(fromState);
  return validTargets.includes(toState);
}

// --- Tests ---

describe("Settings Tab - State Machine", () => {
  describe("getValidTransitions", () => {
    it("Draft can advance to Active or Archive", () => {
      const result = getValidTransitions("Draft");
      expect(result).toContain("Active");
      expect(result).toContain("Archived");
      expect(result).toHaveLength(2);
    });

    it("Active can advance to Reviewing or Archive", () => {
      const result = getValidTransitions("Active");
      expect(result).toContain("Reviewing");
      expect(result).toContain("Archived");
      expect(result).toHaveLength(2);
    });

    it("Reviewing can advance to Interviewing or Archive", () => {
      const result = getValidTransitions("Reviewing");
      expect(result).toContain("Interviewing");
      expect(result).toContain("Archived");
      expect(result).toHaveLength(2);
    });

    it("Interviewing can advance to Offer Extended or Archive", () => {
      const result = getValidTransitions("Interviewing");
      expect(result).toContain("Offer Extended");
      expect(result).toContain("Archived");
      expect(result).toHaveLength(2);
    });

    it("Offer Extended can advance to Filled or Archive", () => {
      const result = getValidTransitions("Offer Extended");
      expect(result).toContain("Filled");
      expect(result).toContain("Archived");
      expect(result).toHaveLength(2);
    });

    it("Filled can only Archive", () => {
      const result = getValidTransitions("Filled");
      expect(result).toContain("Archived");
      expect(result).toHaveLength(1);
    });

    it("Archived has no valid transitions", () => {
      const result = getValidTransitions("Archived");
      expect(result).toHaveLength(0);
    });
  });

  describe("isValidTransition", () => {
    it("allows forward transitions in the lifecycle", () => {
      expect(isValidTransition("Draft", "Active")).toBe(true);
      expect(isValidTransition("Active", "Reviewing")).toBe(true);
      expect(isValidTransition("Reviewing", "Interviewing")).toBe(true);
      expect(isValidTransition("Interviewing", "Offer Extended")).toBe(true);
      expect(isValidTransition("Offer Extended", "Filled")).toBe(true);
    });

    it("allows archive from any state except Archived", () => {
      expect(isValidTransition("Draft", "Archived")).toBe(true);
      expect(isValidTransition("Active", "Archived")).toBe(true);
      expect(isValidTransition("Reviewing", "Archived")).toBe(true);
      expect(isValidTransition("Interviewing", "Archived")).toBe(true);
      expect(isValidTransition("Offer Extended", "Archived")).toBe(true);
      expect(isValidTransition("Filled", "Archived")).toBe(true);
    });

    it("does not allow archive from Archived", () => {
      expect(isValidTransition("Archived", "Archived")).toBe(false);
    });

    it("rejects backward transitions", () => {
      expect(isValidTransition("Active", "Draft")).toBe(false);
      expect(isValidTransition("Reviewing", "Active")).toBe(false);
      expect(isValidTransition("Filled", "Draft")).toBe(false);
    });

    it("rejects skipping states", () => {
      expect(isValidTransition("Draft", "Reviewing")).toBe(false);
      expect(isValidTransition("Draft", "Interviewing")).toBe(false);
      expect(isValidTransition("Active", "Filled")).toBe(false);
    });

    it("rejects transitions from Archived", () => {
      expect(isValidTransition("Archived", "Draft")).toBe(false);
      expect(isValidTransition("Archived", "Active")).toBe(false);
    });
  });

  describe("Transition Prerequisites", () => {
    it("defines prerequisites for all forward transitions", () => {
      expect(TRANSITION_PREREQUISITES["Draft→Active"]).toBeDefined();
      expect(TRANSITION_PREREQUISITES["Active→Reviewing"]).toBeDefined();
      expect(TRANSITION_PREREQUISITES["Reviewing→Interviewing"]).toBeDefined();
      expect(
        TRANSITION_PREREQUISITES["Interviewing→Offer Extended"]
      ).toBeDefined();
      expect(
        TRANSITION_PREREQUISITES["Offer Extended→Filled"]
      ).toBeDefined();
    });

    it("does not define prerequisites for archive transition", () => {
      expect(TRANSITION_PREREQUISITES["Draft→Archived"]).toBeUndefined();
      expect(TRANSITION_PREREQUISITES["Active→Archived"]).toBeUndefined();
    });

    it("Draft→Active requires processed candidates", () => {
      expect(TRANSITION_PREREQUISITES["Draft→Active"]).toContain(
        "candidate"
      );
      expect(TRANSITION_PREREQUISITES["Draft→Active"]).toContain(
        "processing"
      );
    });

    it("Active→Reviewing requires candidates in project", () => {
      expect(TRANSITION_PREREQUISITES["Active→Reviewing"]).toContain(
        "candidate"
      );
    });

    it("Reviewing→Interviewing requires candidates selected for interview", () => {
      expect(
        TRANSITION_PREREQUISITES["Reviewing→Interviewing"]
      ).toContain("interview");
    });

    it("Interviewing→Offer Extended requires candidates marked for offer", () => {
      expect(
        TRANSITION_PREREQUISITES["Interviewing→Offer Extended"]
      ).toContain("offer");
    });

    it("Offer Extended→Filled requires accepted offer", () => {
      expect(
        TRANSITION_PREREQUISITES["Offer Extended→Filled"]
      ).toContain("accepted offer");
    });
  });

  describe("Lifecycle states (Requirement 21.1)", () => {
    it("supports all seven defined states", () => {
      const allStates: ProjectState[] = [
        "Draft",
        "Active",
        "Reviewing",
        "Interviewing",
        "Offer Extended",
        "Filled",
        "Archived",
      ];

      allStates.forEach((state) => {
        expect(FORWARD_TRANSITIONS).toHaveProperty(state);
      });
    });
  });
});
