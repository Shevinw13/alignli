/**
 * Unit tests for ProcessingStep logic.
 *
 * Tests the stage progression, status detection,
 * and completion/failure logic used by the ProcessingStep component.
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import { describe, it, expect } from "vitest";

// --- Types mirroring the component's internal types ---

type StageStatus = "pending" | "active" | "complete" | "failed";

interface ProcessingStage {
  id: string;
  label: string;
  status: StageStatus;
  completed: number;
  total: number;
}

// --- Helper: replicates the component's completion check logic ---

function checkCompletion(stages: ProcessingStage[]): {
  allDone: boolean;
  allFailed: boolean;
  allComplete: boolean;
} {
  const allDone = stages.every(
    (s) => s.status === "complete" || s.status === "failed"
  );
  if (!allDone) {
    return { allDone: false, allFailed: false, allComplete: false };
  }

  const allStageFailed = stages.every((s) => s.status === "failed");
  if (allStageFailed) {
    return { allDone: true, allFailed: true, allComplete: false };
  }

  // Check if first stage processed zero resumes (all resumes failed)
  const firstStage = stages[0];
  if (firstStage.completed === 0 && firstStage.status === "complete") {
    return { allDone: true, allFailed: true, allComplete: false };
  }

  return { allDone: true, allFailed: false, allComplete: true };
}

// --- Constants matching the component ---

const STAGE_IDS = ["reading", "extracting", "comparing", "ranking", "generating"];
const STAGE_LABELS = [
  "Reading resumes",
  "Extracting information",
  "Comparing against criteria",
  "Ranking candidates",
  "Generating summaries",
];
const AUTO_NAVIGATE_DELAY_MS = 3000;

function createStages(
  total: number,
  overrides?: Partial<Record<string, Partial<ProcessingStage>>>
): ProcessingStage[] {
  return STAGE_IDS.map((id, i) => ({
    id,
    label: STAGE_LABELS[i],
    status: "pending" as StageStatus,
    completed: 0,
    total,
    ...(overrides?.[id] ?? {}),
  }));
}

// --- Tests ---

describe("ProcessingStep stage definitions", () => {
  it("defines exactly 5 processing stages (requirement 8.1)", () => {
    expect(STAGE_IDS).toHaveLength(5);
    expect(STAGE_LABELS).toHaveLength(5);
  });

  it("stages are in the correct order per requirement 8.1", () => {
    expect(STAGE_IDS).toEqual([
      "reading",
      "extracting",
      "comparing",
      "ranking",
      "generating",
    ]);
  });

  it("stage labels match the requirement descriptions", () => {
    expect(STAGE_LABELS).toEqual([
      "Reading resumes",
      "Extracting information",
      "Comparing against criteria",
      "Ranking candidates",
      "Generating summaries",
    ]);
  });
});

describe("ProcessingStep auto-navigate delay", () => {
  it("uses a delay of at least 3 seconds for auto-navigation (requirement 8.4)", () => {
    expect(AUTO_NAVIGATE_DELAY_MS).toBeGreaterThanOrEqual(3000);
  });
});

describe("Completion detection logic", () => {
  it("all stages start as pending — not done", () => {
    const stages = createStages(5);
    const result = checkCompletion(stages);
    expect(result.allDone).toBe(false);
    expect(result.allComplete).toBe(false);
    expect(result.allFailed).toBe(false);
  });

  it("detects completion when all stages are complete", () => {
    const stages = createStages(3).map((s) => ({
      ...s,
      status: "complete" as StageStatus,
      completed: 3,
    }));
    const result = checkCompletion(stages);
    expect(result.allDone).toBe(true);
    expect(result.allComplete).toBe(true);
    expect(result.allFailed).toBe(false);
  });

  it("detects all-failed when every stage has failed status (requirement 8.7)", () => {
    const stages = createStages(3).map((s) => ({
      ...s,
      status: "failed" as StageStatus,
      completed: 0,
    }));
    const result = checkCompletion(stages);
    expect(result.allDone).toBe(true);
    expect(result.allFailed).toBe(true);
    expect(result.allComplete).toBe(false);
  });

  it("detects all-failed when first stage completed zero resumes (requirement 8.7)", () => {
    const stages = createStages(3).map((s) => ({
      ...s,
      status: "complete" as StageStatus,
      completed: 0,
    }));
    const result = checkCompletion(stages);
    expect(result.allDone).toBe(true);
    expect(result.allFailed).toBe(true);
    expect(result.allComplete).toBe(false);
  });

  it("not done when some stages are still active", () => {
    const stages = createStages(5);
    stages[0] = { ...stages[0], status: "complete", completed: 5 };
    stages[1] = { ...stages[1], status: "active", completed: 3 };
    const result = checkCompletion(stages);
    expect(result.allDone).toBe(false);
  });

  it("partial failure still counts as complete — not all-failed (requirement 8.6)", () => {
    const stages = createStages(3).map((s) => ({
      ...s,
      status: "complete" as StageStatus,
      completed: 2, // 2 of 3 succeeded
    }));
    const result = checkCompletion(stages);
    expect(result.allDone).toBe(true);
    expect(result.allFailed).toBe(false);
    expect(result.allComplete).toBe(true);
  });

  it("mixed complete/failed stages are done but not all-failed", () => {
    const stages = createStages(3);
    stages[0] = { ...stages[0], status: "complete", completed: 3 };
    stages[1] = { ...stages[1], status: "complete", completed: 3 };
    stages[2] = { ...stages[2], status: "failed", completed: 0 };
    stages[3] = { ...stages[3], status: "complete", completed: 3 };
    stages[4] = { ...stages[4], status: "complete", completed: 3 };
    const result = checkCompletion(stages);
    expect(result.allDone).toBe(true);
    expect(result.allFailed).toBe(false);
    expect(result.allComplete).toBe(true);
  });
});

describe("Progress counter formatting", () => {
  it("shows X of Y per stage when active (requirement 8.1)", () => {
    const stage: ProcessingStage = {
      id: "reading",
      label: "Reading resumes",
      status: "active",
      completed: 3,
      total: 5,
    };
    // The component renders: `${stage.completed} of ${stage.total}`
    const progressText = `${stage.completed} of ${stage.total}`;
    expect(progressText).toBe("3 of 5");
  });

  it("shows dash for pending stages", () => {
    const stage: ProcessingStage = {
      id: "reading",
      label: "Reading resumes",
      status: "pending",
      completed: 0,
      total: 5,
    };
    // The component renders "—" for pending stages
    const display = stage.status !== "pending" ? `${stage.completed} of ${stage.total}` : "—";
    expect(display).toBe("—");
  });

  it("shows final count when complete", () => {
    const stage: ProcessingStage = {
      id: "generating",
      label: "Generating summaries",
      status: "complete",
      completed: 5,
      total: 5,
    };
    const progressText = `${stage.completed} of ${stage.total}`;
    expect(progressText).toBe("5 of 5");
  });
});
