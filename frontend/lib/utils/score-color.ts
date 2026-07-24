/**
 * Score color coding utility for candidate Match_Score display.
 *
 * Maps integer scores (0-100) to color strings for visual representation.
 * Colors are used consistently across frontend and backend.
 *
 * Ranges (no gaps or overlaps):
 *   - Green: 95-100
 *   - Blue:  80-94
 *   - Amber: 65-79
 *   - Gray:   0-64
 *
 * Requirements: 10.3
 */

export type ScoreColor = "green" | "blue" | "amber" | "gray";

/**
 * Map a candidate Match_Score to a display color.
 *
 * @param score - Integer score in the range [0, 100].
 * @returns Color string: "green", "blue", "amber", or "gray".
 * @throws {Error} If score is not an integer or is outside [0, 100].
 */
export function scoreColor(score: number): ScoreColor {
  if (!Number.isInteger(score)) {
    throw new Error(`score must be an integer, got ${score}`);
  }
  if (score < 0 || score > 100) {
    throw new Error(`score must be between 0 and 100, got ${score}`);
  }

  if (score >= 95) {
    return "green";
  } else if (score >= 80) {
    return "blue";
  } else if (score >= 65) {
    return "amber";
  } else {
    return "gray";
  }
}
