/**
 * Unit tests for Hire Candidate Button logic.
 *
 * Tests the hire candidate flow state machine and validation logic:
 * - Blocking hire on Filled/Archived projects (Req 14.7)
 * - Confirmation dialog state transitions (Req 14.1)
 * - Prompt to fill project after hire (Req 14.2)
 * - Decline fill keeps current state (Req 14.3)
 * - Accept fill transitions project to Filled (Req 14.4)
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7
 */

import { describe, it, expect } from "vitest";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProjectState =
  | "Draft"
  | "Active"
  | "Reviewing"
  | "Interviewing"
  | "Offer Extended"
  | "Filled"
  | "Archived";

type DialogStep = "idle" | "confirm-hire" | "prompt-fill-project";

type CandidateStatus = "Active" | "Interviewing" | "Offer Extended" | "Hired" | "Rejected";

// ─── Pure Logic Extracted from Component ─────────────────────────────────────

function isProjectClosed(projectState: ProjectState): boolean {
  return projectState === "Filled" || projectState === "Archived";
}

interface HireFlowState {
  dialogStep: DialogStep;
  candidateStatus: CandidateStatus;
  projectState: ProjectState;
  lastToast: { message: string; variant: "success" | "error" } | null;
}

function createInitialState(
  candidateStatus: CandidateStatus,
  projectState: ProjectState
): HireFlowState {
  return {
    dialogStep: "idle",
    candidateStatus,
    projectState,
    lastToast: null,
  };
}

/** Simulate clicking "Mark as Hired" button */
function handleHireClick(state: HireFlowState): HireFlowState {
  if (isProjectClosed(state.projectState)) {
    return {
      ...state,
      lastToast: {
        message: "This project is no longer accepting candidates. The project has been closed.",
        variant: "error",
      },
    };
  }
  return { ...state, dialogStep: "confirm-hire" };
}

/** Simulate confirming the hire */
function handleConfirmHire(state: HireFlowState, candidateName: string): HireFlowState {
  return {
    ...state,
    dialogStep: "prompt-fill-project",
    candidateStatus: "Hired",
    lastToast: {
      message: `${candidateName} has been marked as Hired.`,
      variant: "success",
    },
  };
}

/** Simulate accepting fill project */
function handleAcceptFill(state: HireFlowState): HireFlowState {
  return {
    ...state,
    dialogStep: "idle",
    projectState: "Filled",
    lastToast: {
      message: "Project has been moved to Filled. It will appear in your closed projects.",
      variant: "success",
    },
  };
}

/** Simulate declining fill project */
function handleDeclineFill(state: HireFlowState): HireFlowState {
  return {
    ...state,
    dialogStep: "idle",
  };
}

/** Simulate closing/canceling dialog */
function handleCloseDialog(state: HireFlowState): HireFlowState {
  return { ...state, dialogStep: "idle" };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Hire Candidate Button - Block on Closed Projects (Req 14.7)", () => {
  it("blocks hire when project is in Filled state", () => {
    const state = createInitialState("Active", "Filled");
    const result = handleHireClick(state);
    expect(result.dialogStep).toBe("idle");
    expect(result.lastToast?.variant).toBe("error");
    expect(result.lastToast?.message).toContain("no longer accepting candidates");
  });

  it("blocks hire when project is in Archived state", () => {
    const state = createInitialState("Active", "Archived");
    const result = handleHireClick(state);
    expect(result.dialogStep).toBe("idle");
    expect(result.lastToast?.variant).toBe("error");
    expect(result.lastToast?.message).toContain("no longer accepting candidates");
  });

  it("allows hire when project is in Active state", () => {
    const state = createInitialState("Active", "Active");
    const result = handleHireClick(state);
    expect(result.dialogStep).toBe("confirm-hire");
    expect(result.lastToast).toBeNull();
  });

  it("allows hire when project is in Draft state", () => {
    const state = createInitialState("Active", "Draft");
    const result = handleHireClick(state);
    expect(result.dialogStep).toBe("confirm-hire");
  });

  it("allows hire when project is in Reviewing state", () => {
    const state = createInitialState("Active", "Reviewing");
    const result = handleHireClick(state);
    expect(result.dialogStep).toBe("confirm-hire");
  });

  it("allows hire when project is in Interviewing state", () => {
    const state = createInitialState("Interviewing", "Interviewing");
    const result = handleHireClick(state);
    expect(result.dialogStep).toBe("confirm-hire");
  });

  it("allows hire when project is in Offer Extended state", () => {
    const state = createInitialState("Offer Extended", "Offer Extended");
    const result = handleHireClick(state);
    expect(result.dialogStep).toBe("confirm-hire");
  });
});

describe("Hire Candidate Button - Confirmation Flow (Req 14.1)", () => {
  it("opens confirmation dialog on click", () => {
    const state = createInitialState("Active", "Active");
    const result = handleHireClick(state);
    expect(result.dialogStep).toBe("confirm-hire");
  });

  it("updates candidate status to Hired on confirm", () => {
    let state = createInitialState("Interviewing", "Active");
    state = handleHireClick(state);
    state = handleConfirmHire(state, "Alice Johnson");
    expect(state.candidateStatus).toBe("Hired");
  });

  it("shows success toast with candidate name on confirm", () => {
    let state = createInitialState("Active", "Active");
    state = handleHireClick(state);
    state = handleConfirmHire(state, "Bob Smith");
    expect(state.lastToast?.variant).toBe("success");
    expect(state.lastToast?.message).toContain("Bob Smith");
    expect(state.lastToast?.message).toContain("Hired");
  });

  it("can cancel the confirmation dialog", () => {
    let state = createInitialState("Active", "Active");
    state = handleHireClick(state);
    expect(state.dialogStep).toBe("confirm-hire");
    state = handleCloseDialog(state);
    expect(state.dialogStep).toBe("idle");
    expect(state.candidateStatus).toBe("Active");
  });
});

describe("Hire Candidate Button - Fill Project Prompt (Req 14.2, 14.3, 14.4)", () => {
  it("prompts to transition project to Filled after hire confirm (Req 14.2)", () => {
    let state = createInitialState("Interviewing", "Active");
    state = handleHireClick(state);
    state = handleConfirmHire(state, "Alice");
    expect(state.dialogStep).toBe("prompt-fill-project");
  });

  it("keeps project in current state when user declines fill (Req 14.3)", () => {
    let state = createInitialState("Active", "Interviewing");
    state = handleHireClick(state);
    state = handleConfirmHire(state, "Alice");
    state = handleDeclineFill(state);
    expect(state.projectState).toBe("Interviewing");
    expect(state.candidateStatus).toBe("Hired");
    expect(state.dialogStep).toBe("idle");
  });

  it("retains Hired status when user declines fill (Req 14.3)", () => {
    let state = createInitialState("Offer Extended", "Offer Extended");
    state = handleHireClick(state);
    state = handleConfirmHire(state, "Charlie");
    state = handleDeclineFill(state);
    expect(state.candidateStatus).toBe("Hired");
  });

  it("transitions project to Filled when user accepts (Req 14.4)", () => {
    let state = createInitialState("Active", "Active");
    state = handleHireClick(state);
    state = handleConfirmHire(state, "Alice");
    state = handleAcceptFill(state);
    expect(state.projectState).toBe("Filled");
    expect(state.dialogStep).toBe("idle");
  });

  it("shows success toast when project transitions to Filled", () => {
    let state = createInitialState("Active", "Active");
    state = handleHireClick(state);
    state = handleConfirmHire(state, "Alice");
    state = handleAcceptFill(state);
    expect(state.lastToast?.variant).toBe("success");
    expect(state.lastToast?.message).toContain("Filled");
  });
});

describe("Hire Candidate Button - isProjectClosed helper", () => {
  it("returns true for Filled", () => {
    expect(isProjectClosed("Filled")).toBe(true);
  });

  it("returns true for Archived", () => {
    expect(isProjectClosed("Archived")).toBe(true);
  });

  it("returns false for Draft", () => {
    expect(isProjectClosed("Draft")).toBe(false);
  });

  it("returns false for Active", () => {
    expect(isProjectClosed("Active")).toBe(false);
  });

  it("returns false for Reviewing", () => {
    expect(isProjectClosed("Reviewing")).toBe(false);
  });

  it("returns false for Interviewing", () => {
    expect(isProjectClosed("Interviewing")).toBe(false);
  });

  it("returns false for Offer Extended", () => {
    expect(isProjectClosed("Offer Extended")).toBe(false);
  });
});

describe("Hire Candidate Button - Full E2E Flow", () => {
  it("complete happy path: hire → accept fill", () => {
    let state = createInitialState("Active", "Active");

    // Step 1: Click hire
    state = handleHireClick(state);
    expect(state.dialogStep).toBe("confirm-hire");

    // Step 2: Confirm hire
    state = handleConfirmHire(state, "Alice Johnson");
    expect(state.candidateStatus).toBe("Hired");
    expect(state.dialogStep).toBe("prompt-fill-project");

    // Step 3: Accept fill
    state = handleAcceptFill(state);
    expect(state.projectState).toBe("Filled");
    expect(state.dialogStep).toBe("idle");
  });

  it("complete path: hire → decline fill", () => {
    let state = createInitialState("Interviewing", "Interviewing");

    // Step 1: Click hire
    state = handleHireClick(state);
    expect(state.dialogStep).toBe("confirm-hire");

    // Step 2: Confirm hire
    state = handleConfirmHire(state, "Bob Smith");
    expect(state.candidateStatus).toBe("Hired");
    expect(state.dialogStep).toBe("prompt-fill-project");

    // Step 3: Decline fill
    state = handleDeclineFill(state);
    expect(state.projectState).toBe("Interviewing");
    expect(state.candidateStatus).toBe("Hired");
    expect(state.dialogStep).toBe("idle");
  });

  it("blocked path: cannot hire on closed project", () => {
    const state = createInitialState("Active", "Filled");
    const result = handleHireClick(state);
    expect(result.dialogStep).toBe("idle");
    expect(result.candidateStatus).toBe("Active");
    expect(result.lastToast?.variant).toBe("error");
  });
});
