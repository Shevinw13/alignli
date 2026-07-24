"""Ranking criteria AI generation from extracted job descriptions.

Generates default ranking criteria based on extracted JD categories.
Each criterion includes: category, priority (Low/Medium/High), max_score (1-100).

Requirements: 5.1, 5.2
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.ai.service import AIService, AIServiceResponse, PromptType


class RankingCriterionResult(BaseModel):
    """A single generated ranking criterion."""

    category: str = Field(
        ...,
        description="One of: Skill Match, Experience, Education, Leadership, "
        "Certifications, Location, Career Growth, Employment Stability, Custom",
    )
    label: str = Field(..., description="Descriptive name for the criterion")
    priority: str = Field(..., description="Low, Medium, or High")
    max_score: int = Field(..., ge=1, le=100, description="Maximum score 1-100")

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        allowed = {"Low", "Medium", "High"}
        if v not in allowed:
            raise ValueError(f"Priority must be one of {allowed}, got '{v}'")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = {
            "Skill Match",
            "Experience",
            "Education",
            "Leadership",
            "Certifications",
            "Location",
            "Career Growth",
            "Employment Stability",
            "Custom",
        }
        if v not in allowed:
            raise ValueError(f"Category must be one of {allowed}, got '{v}'")
        return v


class CriteriaGenerationResult(BaseModel):
    """Result of criteria generation from extracted JD."""

    criteria: list[RankingCriterionResult] = Field(default_factory=list)


class CriteriaGenerationError(Exception):
    """Raised when criteria generation fails."""

    def __init__(self, message: str, ai_error: Optional[str] = None):
        self.message = message
        self.ai_error = ai_error
        super().__init__(message)


VALID_CATEGORIES = {
    "Skill Match",
    "Experience",
    "Education",
    "Leadership",
    "Certifications",
    "Location",
    "Career Growth",
    "Employment Stability",
    "Custom",
}


def _normalize_criterion(raw: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Normalize and validate a single raw criterion from AI response.

    Returns None if the criterion cannot be salvaged.
    """
    category = raw.get("category", "").strip()
    label = raw.get("label", "").strip()
    priority = raw.get("priority", "").strip().capitalize()
    max_score = raw.get("max_score")

    # Validate category
    if category not in VALID_CATEGORIES:
        # Try fuzzy matching common variations
        category_lower = category.lower()
        for valid_cat in VALID_CATEGORIES:
            if valid_cat.lower() == category_lower:
                category = valid_cat
                break
        else:
            category = "Custom"

    # Validate priority
    if priority not in ("Low", "Medium", "High"):
        priority = "Medium"  # Default fallback

    # Validate max_score
    if isinstance(max_score, (int, float)):
        max_score = int(max_score)
        max_score = max(1, min(100, max_score))
    else:
        max_score = 100  # Default

    # Label is required
    if not label:
        return None

    return {
        "category": category,
        "label": label,
        "priority": priority,
        "max_score": max_score,
    }


def parse_criteria_response(ai_response: AIServiceResponse) -> CriteriaGenerationResult:
    """Parse an AI service response into structured criteria.

    Handles various response formats and normalizes criteria.
    Raises CriteriaGenerationError if the response cannot be parsed.
    """
    if ai_response.error:
        raise CriteriaGenerationError(
            message="AI service returned an error",
            ai_error=ai_response.error,
        )

    content = ai_response.content
    if not content:
        raise CriteriaGenerationError(message="AI service returned empty content")

    # Extract criteria list from response
    raw_criteria: list[dict[str, Any]] = []

    if "criteria" in content and isinstance(content["criteria"], list):
        raw_criteria = content["criteria"]
    elif "raw_response" in content:
        # Try to parse the raw response as JSON
        try:
            parsed = json.loads(content["raw_response"])
            if isinstance(parsed, dict) and "criteria" in parsed:
                raw_criteria = parsed["criteria"]
            elif isinstance(parsed, list):
                raw_criteria = parsed
        except (json.JSONDecodeError, TypeError):
            raise CriteriaGenerationError(
                message="Could not parse AI response as criteria"
            )
    else:
        # Maybe the content itself is a list or has a different structure
        if isinstance(content, dict):
            # Look for any list value that looks like criteria
            for value in content.values():
                if isinstance(value, list) and len(value) > 0:
                    if isinstance(value[0], dict) and "category" in value[0]:
                        raw_criteria = value
                        break

    if not raw_criteria:
        raise CriteriaGenerationError(
            message="AI response did not contain criteria"
        )

    # Normalize and validate each criterion
    criteria = []
    for raw in raw_criteria:
        if not isinstance(raw, dict):
            continue
        normalized = _normalize_criterion(raw)
        if normalized:
            criteria.append(RankingCriterionResult(**normalized))

    if not criteria:
        raise CriteriaGenerationError(
            message="No valid criteria could be parsed from AI response"
        )

    return CriteriaGenerationResult(criteria=criteria)


async def generate_ranking_criteria(
    extracted_jd: dict[str, Any],
    ai_service: AIService,
    *,
    db: Optional[AsyncSession] = None,
    organization_id: Optional[uuid.UUID] = None,
    hiring_project_id: Optional[uuid.UUID] = None,
) -> CriteriaGenerationResult:
    """Generate default ranking criteria from an extracted job description.

    Takes the extracted JD data (categories like Required Skills, Preferred Skills,
    Education, etc.) and uses AI to generate appropriate ranking criteria.

    Args:
        extracted_jd: The extracted job description categories (from task 9.2).
        ai_service: The AI service instance to use for generation.
        db: Optional database session for storing AI response.
        organization_id: Organization context for auditability.
        hiring_project_id: Optional project context.

    Returns:
        CriteriaGenerationResult with a list of ranking criteria.

    Raises:
        CriteriaGenerationError: If criteria generation or parsing fails.
    """
    # Format the extracted JD as user content for the AI
    user_content = json.dumps(extracted_jd, indent=2)

    # Call the AI service with the ranking criteria prompt
    ai_response = await ai_service.call(
        prompt_type=PromptType.RANKING_CRITERIA,
        user_content=user_content,
        db=db,
        organization_id=organization_id,
        hiring_project_id=hiring_project_id,
    )

    # Parse and validate the response
    return parse_criteria_response(ai_response)
