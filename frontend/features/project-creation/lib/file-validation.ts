/**
 * File validation utilities for the Resume Upload step.
 *
 * Validates files before upload:
 * - Only PDF files accepted (checks extension + MIME type)
 * - Maximum 10 MB per file
 * - Maximum 50 files per batch
 *
 * Requirements: 6.1, 6.2, 6.5, 6.7
 */

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES_PER_BATCH = 50;
const ACCEPTED_MIME_TYPE = "application/pdf";
const ACCEPTED_EXTENSION = ".pdf";

/**
 * Validate a single file for upload eligibility.
 *
 * @param file - The File object to validate.
 * @returns null if valid, or a string describing the rejection reason.
 */
export function validateFile(file: File): string | null {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (extension !== ACCEPTED_EXTENSION && file.type !== ACCEPTED_MIME_TYPE) {
    return "Only PDF files are accepted";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File exceeds 10 MB size limit";
  }
  return null;
}

/**
 * Format a byte count into a human-readable string.
 *
 * @param bytes - Number of bytes.
 * @returns Formatted string (e.g., "1.5 KB", "3.2 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
