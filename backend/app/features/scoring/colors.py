"""Score color coding utility for candidate Match_Score display.

Maps integer scores (0-100) to color strings for visual representation.
Colors are used consistently across frontend and backend.

Ranges (no gaps or overlaps):
  - Green: 95-100
  - Blue:  80-94
  - Amber: 65-79
  - Gray:   0-64

Requirements: 10.3
"""

from __future__ import annotations


def score_color(score: int) -> str:
    """Map a candidate Match_Score to a display color.

    Args:
        score: Integer score in the range [0, 100].

    Returns:
        Color string: "green", "blue", "amber", or "gray".

    Raises:
        ValueError: If score is not an integer or is outside [0, 100].
    """
    if not isinstance(score, int):
        raise ValueError(f"score must be an integer, got {type(score).__name__}")
    if score < 0 or score > 100:
        raise ValueError(f"score must be between 0 and 100, got {score}")

    if score >= 95:
        return "green"
    elif score >= 80:
        return "blue"
    elif score >= 65:
        return "amber"
    else:
        return "gray"
