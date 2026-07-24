/**
 * Unit tests for ResumeUploadStep validation logic.
 *
 * Tests file validation rules: PDF-only, max 10 MB, batch limit of 50.
 * Requirements: 6.1, 6.2, 6.5, 6.7, 6.8
 */

import { describe, it, expect } from "vitest";
import { validateFile, formatFileSize, MAX_FILE_SIZE_BYTES, MAX_FILES_PER_BATCH } from "../lib/file-validation";

describe("validateFile", () => {
  function createMockFile(name: string, size: number, type: string): File {
    const blob = new Blob(["x".repeat(Math.min(size, 100))], { type });
    Object.defineProperty(blob, "size", { value: size });
    Object.defineProperty(blob, "name", { value: name });
    return blob as File;
  }

  describe("PDF validation", () => {
    it("accepts a valid PDF file by extension and MIME type", () => {
      const file = createMockFile("resume.pdf", 1024, "application/pdf");
      expect(validateFile(file)).toBeNull();
    });

    it("accepts a PDF file with correct extension but empty MIME", () => {
      const file = createMockFile("resume.pdf", 1024, "");
      expect(validateFile(file)).toBeNull();
    });

    it("accepts a PDF file with correct MIME but odd extension", () => {
      const file = createMockFile("resume.PDF", 1024, "application/pdf");
      expect(validateFile(file)).toBeNull();
    });

    it("rejects a .docx file", () => {
      const file = createMockFile("resume.docx", 1024, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      expect(validateFile(file)).toBe("Only PDF files are accepted");
    });

    it("rejects a .txt file", () => {
      const file = createMockFile("notes.txt", 512, "text/plain");
      expect(validateFile(file)).toBe("Only PDF files are accepted");
    });

    it("rejects a .jpg file", () => {
      const file = createMockFile("photo.jpg", 2048, "image/jpeg");
      expect(validateFile(file)).toBe("Only PDF files are accepted");
    });

    it("rejects a file with no extension and wrong MIME", () => {
      const file = createMockFile("resume", 1024, "text/plain");
      expect(validateFile(file)).toBe("Only PDF files are accepted");
    });
  });

  describe("file size validation", () => {
    it("accepts a file exactly at the 10 MB limit", () => {
      const file = createMockFile("big.pdf", MAX_FILE_SIZE_BYTES, "application/pdf");
      expect(validateFile(file)).toBeNull();
    });

    it("rejects a file exceeding 10 MB", () => {
      const file = createMockFile("huge.pdf", MAX_FILE_SIZE_BYTES + 1, "application/pdf");
      expect(validateFile(file)).toBe("File exceeds 10 MB size limit");
    });

    it("accepts a very small PDF file", () => {
      const file = createMockFile("tiny.pdf", 1, "application/pdf");
      expect(validateFile(file)).toBeNull();
    });
  });

  describe("combined validation", () => {
    it("rejects non-PDF before checking size", () => {
      // Non-PDF file that's also too large — should get PDF rejection message
      const file = createMockFile("big.docx", MAX_FILE_SIZE_BYTES + 100, "application/msword");
      expect(validateFile(file)).toBe("Only PDF files are accepted");
    });
  });
});

describe("formatFileSize", () => {
  it("formats bytes correctly", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes correctly", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats edge case at 1024 boundary", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
  });

  it("formats edge case at 1 MB boundary", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
  });
});

describe("constants", () => {
  it("MAX_FILE_SIZE_BYTES is 10 MB", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it("MAX_FILES_PER_BATCH is 50", () => {
    expect(MAX_FILES_PER_BATCH).toBe(50);
  });
});
