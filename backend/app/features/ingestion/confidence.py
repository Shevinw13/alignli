"""Confidence level classification for parsed resume data.

Classifies the confidence level of a parsed resume based on which
structured fields were successfully populated during ingestion.

Requirements: 7.7
"""

from __future__ import annotations

from typing import Any, Dict, Optional


# Confidence level constants
HIGH = "High"
MEDIUM = "Medium"
LOW = "Low"

# Fields required for High confidence
ALL_FIELDS = ("contact_info", "work_experience", "education", "skills", "certifications")

# Fields required for Medium confidence
MEDIUM_FIELDS = ("contact_info", "work_experience")


def _is_populated(value: Any) -> bool:
    """Check whether a field value is considered populated.

    A field is populated if it exists and is non-null and non-empty.
    For lists, it must have at least one entry.
    For dicts, it must have at least one key-value pair.
    For strings, it must be non-empty after stripping whitespace.

    Args:
        value: The field value to check.

    Returns:
        True if the field is considered populated, False otherwise.
    """
    if value is None:
        return False
    if isinstance(value, (list, dict)):
        return len(value) > 0
    if isinstance(value, str):
        return len(value.strip()) > 0
    # For other truthy values (numbers, etc.), consider populated
    return True


def classify_confidence(parsed_data: Optional[Dict[str, Any]]) -> str:
    """Classify confidence level based on parsed data field population.

    Classification rules:
    - High: All structured fields are populated (contact_info, work_experience,
      education, skills, certifications)
    - Medium: At least contact_info AND work_experience are populated
    - Low: One or more of contact_info or work_experience could not be extracted,
      or parsed_data is None/empty

    Args:
        parsed_data: Dictionary of parsed resume data (JSONB), or None.

    Returns:
        Confidence level string: "High", "Medium", or "Low".
    """
    if not parsed_data:
        return LOW

    # Check if all fields are populated -> High
    all_populated = all(_is_populated(parsed_data.get(field)) for field in ALL_FIELDS)
    if all_populated:
        return HIGH

    # Check if at least contact_info and work_experience are populated -> Medium
    medium_populated = all(_is_populated(parsed_data.get(field)) for field in MEDIUM_FIELDS)
    if medium_populated:
        return MEDIUM

    # Otherwise -> Low
    return LOW
