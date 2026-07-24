/**
 * Unit tests for Communication tab validation logic.
 *
 * Tests email compose form validation and status badge mapping.
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { describe, it, expect } from "vitest";

// --- Validation Logic (mirrors component internals) ---

const MAX_SUBJECT_LENGTH = 255;
const MAX_BODY_LENGTH = 10000;

interface ComposeFormData {
  recipientCandidateId: string;
  subject: string;
  body: string;
}

interface FieldErrors {
  recipientCandidateId?: string;
  subject?: string;
  body?: string;
}

function validateComposeForm(data: ComposeFormData): FieldErrors {
  const errors: FieldErrors = {};

  if (!data.recipientCandidateId) {
    errors.recipientCandidateId = "Recipient is required";
  }

  if (!data.subject.trim()) {
    errors.subject = "Subject is required";
  } else if (data.subject.length > MAX_SUBJECT_LENGTH) {
    errors.subject = "Subject must be 255 characters or fewer";
  }

  if (!data.body.trim()) {
    errors.body = "Body is required";
  } else if (data.body.length > MAX_BODY_LENGTH) {
    errors.body = "Body must be 10,000 characters or fewer";
  }

  return errors;
}

// --- Status Badge Logic ---

type DeliveryStatus = "sent" | "failed" | "pending";

function getStatusLabel(status: DeliveryStatus): string {
  const map: Record<DeliveryStatus, string> = {
    sent: "Sent",
    failed: "Failed",
    pending: "Pending",
  };
  return map[status];
}

function getStatusColorCategory(status: DeliveryStatus): "green" | "red" | "amber" {
  const map: Record<DeliveryStatus, "green" | "red" | "amber"> = {
    sent: "green",
    failed: "red",
    pending: "amber",
  };
  return map[status];
}

// --- History Ordering Logic ---

interface EmailHistoryEntry {
  id: string;
  sentAt: string;
}

function sortByMostRecent(entries: EmailHistoryEntry[]): EmailHistoryEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );
}

// --- Tests ---

describe("Communication Tab - Compose Form Validation", () => {
  it("returns error when recipient is missing", () => {
    const result = validateComposeForm({
      recipientCandidateId: "",
      subject: "Hello",
      body: "Message body",
    });
    expect(result.recipientCandidateId).toBe("Recipient is required");
    expect(result.subject).toBeUndefined();
    expect(result.body).toBeUndefined();
  });

  it("returns error when subject is missing", () => {
    const result = validateComposeForm({
      recipientCandidateId: "c1",
      subject: "",
      body: "Message body",
    });
    expect(result.subject).toBe("Subject is required");
    expect(result.recipientCandidateId).toBeUndefined();
    expect(result.body).toBeUndefined();
  });

  it("returns error when subject is whitespace only", () => {
    const result = validateComposeForm({
      recipientCandidateId: "c1",
      subject: "   ",
      body: "Message body",
    });
    expect(result.subject).toBe("Subject is required");
  });

  it("returns error when body is missing", () => {
    const result = validateComposeForm({
      recipientCandidateId: "c1",
      subject: "Hello",
      body: "",
    });
    expect(result.body).toBe("Body is required");
    expect(result.recipientCandidateId).toBeUndefined();
    expect(result.subject).toBeUndefined();
  });

  it("returns error when body is whitespace only", () => {
    const result = validateComposeForm({
      recipientCandidateId: "c1",
      subject: "Hello",
      body: "   ",
    });
    expect(result.body).toBe("Body is required");
  });

  it("returns all errors when all fields are missing", () => {
    const result = validateComposeForm({
      recipientCandidateId: "",
      subject: "",
      body: "",
    });
    expect(result.recipientCandidateId).toBeDefined();
    expect(result.subject).toBeDefined();
    expect(result.body).toBeDefined();
  });

  it("returns no errors when all fields are valid", () => {
    const result = validateComposeForm({
      recipientCandidateId: "c1",
      subject: "Interview follow-up",
      body: "Thank you for your time.",
    });
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("accepts subject at exactly 255 characters", () => {
    const result = validateComposeForm({
      recipientCandidateId: "c1",
      subject: "a".repeat(255),
      body: "Valid body",
    });
    expect(result.subject).toBeUndefined();
  });

  it("rejects subject exceeding 255 characters", () => {
    const result = validateComposeForm({
      recipientCandidateId: "c1",
      subject: "a".repeat(256),
      body: "Valid body",
    });
    expect(result.subject).toContain("255 characters");
  });

  it("accepts body at exactly 10,000 characters", () => {
    const result = validateComposeForm({
      recipientCandidateId: "c1",
      subject: "Subject",
      body: "a".repeat(10000),
    });
    expect(result.body).toBeUndefined();
  });

  it("rejects body exceeding 10,000 characters", () => {
    const result = validateComposeForm({
      recipientCandidateId: "c1",
      subject: "Subject",
      body: "a".repeat(10001),
    });
    expect(result.body).toContain("10,000 characters");
  });
});

describe("Communication Tab - Delivery Status Badge", () => {
  it("maps sent status to green color", () => {
    expect(getStatusColorCategory("sent")).toBe("green");
  });

  it("maps failed status to red color", () => {
    expect(getStatusColorCategory("failed")).toBe("red");
  });

  it("maps pending status to amber color", () => {
    expect(getStatusColorCategory("pending")).toBe("amber");
  });

  it("returns correct label for sent", () => {
    expect(getStatusLabel("sent")).toBe("Sent");
  });

  it("returns correct label for failed", () => {
    expect(getStatusLabel("failed")).toBe("Failed");
  });

  it("returns correct label for pending", () => {
    expect(getStatusLabel("pending")).toBe("Pending");
  });
});

describe("Communication Tab - History Ordering", () => {
  it("sorts emails by most recent first", () => {
    const entries: EmailHistoryEntry[] = [
      { id: "1", sentAt: "2024-01-01T10:00:00Z" },
      { id: "2", sentAt: "2024-06-15T14:30:00Z" },
      { id: "3", sentAt: "2024-03-10T08:00:00Z" },
    ];

    const sorted = sortByMostRecent(entries);
    expect(sorted[0].id).toBe("2");
    expect(sorted[1].id).toBe("3");
    expect(sorted[2].id).toBe("1");
  });

  it("returns empty array for empty input", () => {
    const sorted = sortByMostRecent([]);
    expect(sorted).toHaveLength(0);
  });

  it("handles single entry", () => {
    const entries: EmailHistoryEntry[] = [
      { id: "1", sentAt: "2024-01-01T10:00:00Z" },
    ];
    const sorted = sortByMostRecent(entries);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe("1");
  });

  it("does not mutate original array", () => {
    const entries: EmailHistoryEntry[] = [
      { id: "1", sentAt: "2024-01-01T10:00:00Z" },
      { id: "2", sentAt: "2024-06-15T14:30:00Z" },
    ];
    const original = [...entries];
    sortByMostRecent(entries);
    expect(entries).toEqual(original);
  });
});
