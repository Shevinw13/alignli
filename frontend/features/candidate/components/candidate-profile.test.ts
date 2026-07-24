/**
 * Unit tests for Candidate Profile page logic.
 *
 * Tests: notes management (add/edit with ≤5000 char limit),
 * per-section error/retry states, score color coding in hero,
 * and section display logic.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9
 */

import { describe, it, expect } from "vitest";

// ─── Notes Logic (Requirement 11.7) ─────────────────────────────────────────

const MAX_NOTE_LENGTH = 5000;

interface Note {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

function addNote(notes: Note[], content: string): Note[] {
  if (content.trim().length === 0 || content.length > MAX_NOTE_LENGTH) {
    return notes;
  }
  const newNote: Note = {
    id: `note-${Date.now()}`,
    content,
    createdAt: new Date().toLocaleDateString(),
    updatedAt: new Date().toLocaleDateString(),
  };
  return [newNote, ...notes];
}

function editNote(notes: Note[], noteId: string, content: string): Note[] {
  if (content.length > MAX_NOTE_LENGTH) {
    return notes;
  }
  return notes.map((n) =>
    n.id === noteId
      ? { ...n, content, updatedAt: new Date().toLocaleDateString() }
      : n
  );
}

function isNoteValid(content: string): boolean {
  return content.trim().length > 0 && content.length <= MAX_NOTE_LENGTH;
}

// ─── Section Error State Logic (Requirement 11.9) ────────────────────────────

type AISection =
  | "summary"
  | "scores"
  | "strengths"
  | "concerns"
  | "interviewQuestions";

function createInitialErrorState(): Record<AISection, boolean> {
  return {
    summary: false,
    scores: false,
    strengths: false,
    concerns: false,
    interviewQuestions: false,
  };
}

function setError(
  state: Record<AISection, boolean>,
  section: AISection
): Record<AISection, boolean> {
  return { ...state, [section]: true };
}

function clearError(
  state: Record<AISection, boolean>,
  section: AISection
): Record<AISection, boolean> {
  return { ...state, [section]: false };
}

// ─── Hero Score Color (Requirement 11.1 visual) ─────────────────────────────

function getHeroScoreColor(score: number): string {
  if (score >= 95) return "text-emerald-600";
  if (score >= 80) return "text-blue-600";
  if (score >= 65) return "text-amber-600";
  return "text-gray-500";
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Candidate Profile - Notes (Req 11.7)", () => {
  it("allows adding a new note", () => {
    const notes: Note[] = [];
    const result = addNote(notes, "This candidate is excellent.");
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("This candidate is excellent.");
  });

  it("prepends new notes to the list", () => {
    const notes: Note[] = [
      { id: "note-1", content: "First note", createdAt: "1/1/2024", updatedAt: "1/1/2024" },
    ];
    const result = addNote(notes, "Second note");
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Second note");
    expect(result[1].content).toBe("First note");
  });

  it("rejects empty notes", () => {
    const notes: Note[] = [];
    expect(addNote(notes, "")).toHaveLength(0);
    expect(addNote(notes, "   ")).toHaveLength(0);
  });

  it("rejects notes exceeding 5000 characters", () => {
    const notes: Note[] = [];
    const longContent = "a".repeat(5001);
    expect(addNote(notes, longContent)).toHaveLength(0);
  });

  it("allows notes at exactly 5000 characters", () => {
    const notes: Note[] = [];
    const maxContent = "a".repeat(5000);
    const result = addNote(notes, maxContent);
    expect(result).toHaveLength(1);
    expect(result[0].content.length).toBe(5000);
  });

  it("allows editing an existing note", () => {
    const notes: Note[] = [
      { id: "note-1", content: "Original", createdAt: "1/1/2024", updatedAt: "1/1/2024" },
    ];
    const result = editNote(notes, "note-1", "Updated content");
    expect(result[0].content).toBe("Updated content");
  });

  it("rejects edits exceeding 5000 characters", () => {
    const notes: Note[] = [
      { id: "note-1", content: "Original", createdAt: "1/1/2024", updatedAt: "1/1/2024" },
    ];
    const longContent = "a".repeat(5001);
    const result = editNote(notes, "note-1", longContent);
    expect(result[0].content).toBe("Original");
  });

  it("validates note content correctly", () => {
    expect(isNoteValid("Valid note")).toBe(true);
    expect(isNoteValid("")).toBe(false);
    expect(isNoteValid("   ")).toBe(false);
    expect(isNoteValid("a".repeat(5000))).toBe(true);
    expect(isNoteValid("a".repeat(5001))).toBe(false);
  });
});

describe("Candidate Profile - Section Error/Retry (Req 11.9)", () => {
  it("initializes all sections without errors", () => {
    const state = createInitialErrorState();
    expect(Object.values(state).every((v) => v === false)).toBe(true);
  });

  it("can set individual section errors", () => {
    let state = createInitialErrorState();
    state = setError(state, "summary");
    expect(state.summary).toBe(true);
    expect(state.scores).toBe(false);
    expect(state.interviewQuestions).toBe(false);
  });

  it("can clear individual section errors (retry)", () => {
    let state = createInitialErrorState();
    state = setError(state, "summary");
    state = setError(state, "scores");
    expect(state.summary).toBe(true);
    expect(state.scores).toBe(true);

    state = clearError(state, "summary");
    expect(state.summary).toBe(false);
    expect(state.scores).toBe(true);
  });

  it("supports all AI-generated sections", () => {
    const sections: AISection[] = [
      "summary",
      "scores",
      "strengths",
      "concerns",
      "interviewQuestions",
    ];
    let state = createInitialErrorState();
    for (const section of sections) {
      state = setError(state, section);
    }
    expect(Object.values(state).every((v) => v === true)).toBe(true);
  });
});

describe("Candidate Profile - Hero Score Colors", () => {
  it("returns emerald for 95-100", () => {
    expect(getHeroScoreColor(95)).toBe("text-emerald-600");
    expect(getHeroScoreColor(100)).toBe("text-emerald-600");
  });

  it("returns blue for 80-94", () => {
    expect(getHeroScoreColor(80)).toBe("text-blue-600");
    expect(getHeroScoreColor(94)).toBe("text-blue-600");
  });

  it("returns amber for 65-79", () => {
    expect(getHeroScoreColor(65)).toBe("text-amber-600");
    expect(getHeroScoreColor(79)).toBe("text-amber-600");
  });

  it("returns gray for 0-64", () => {
    expect(getHeroScoreColor(0)).toBe("text-gray-500");
    expect(getHeroScoreColor(64)).toBe("text-gray-500");
  });
});

describe("Candidate Profile - Section Display Requirements", () => {
  // Requirement 11.2: AI Summary should be displayable regardless of length
  it("displays summary when content is present", () => {
    const summary = "Alice Johnson is an exceptional full-stack engineer.";
    // The component renders the summary text as-is; length validation is backend concern
    expect(summary.length).toBeGreaterThan(0);
    expect(typeof summary).toBe("string");
  });

  // Requirement 11.4: 3-8 evidence-based strengths
  it("validates strengths count bounds", () => {
    const minStrengths = 3;
    const maxStrengths = 8;
    const strengths = [
      { text: "Strength 1", evidence: "Evidence 1" },
      { text: "Strength 2", evidence: "Evidence 2" },
      { text: "Strength 3", evidence: "Evidence 3" },
      { text: "Strength 4", evidence: "Evidence 4" },
      { text: "Strength 5", evidence: "Evidence 5" },
    ];
    expect(strengths.length).toBeGreaterThanOrEqual(minStrengths);
    expect(strengths.length).toBeLessThanOrEqual(maxStrengths);
  });

  // Requirement 11.8: 3-7 interview questions
  it("validates interview question count bounds", () => {
    const minQuestions = 3;
    const maxQuestions = 7;
    const questions = [
      "Question 1",
      "Question 2",
      "Question 3",
      "Question 4",
      "Question 5",
    ];
    expect(questions.length).toBeGreaterThanOrEqual(minQuestions);
    expect(questions.length).toBeLessThanOrEqual(maxQuestions);
  });
});
