/**
 * Candidate comparison validation and utilities.
 * Requirements: 12.1, 12.4
 */

export const MIN_CANDIDATES = 2;
export const MAX_CANDIDATES = 4;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates candidate selection count for comparison.
 * Enforces 2–4 candidate selection limit per Requirement 12.4.
 */
export function validateCandidateSelection(
  candidateIds: string[]
): ValidationResult {
  if (candidateIds.length < MIN_CANDIDATES) {
    return {
      valid: false,
      error: `Please select at least ${MIN_CANDIDATES} candidates to compare.`,
    };
  }
  if (candidateIds.length > MAX_CANDIDATES) {
    return {
      valid: false,
      error: `Please select at most ${MAX_CANDIDATES} candidates to compare.`,
    };
  }
  return { valid: true };
}
