"""Job description extraction AI function.

Extracts structured requirements from a job description using AIService
with PromptType.JOB_DESCRIPTION. Returns data grouped by category for user review.

Requirements: 4.1, 4.2, 4.3, 4.4
"""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.ai.schemas import (
    CertificationItem,
    EducationItem,
    ExtractedCategories,
    JDExtractionResponse,
    LocationRequirements,
    SkillItem,
    YearsExperience,
)
from app.features.ai.service import AIService, AIServiceResponse, PromptType


def _parse_skills(raw: list | None) -> list[SkillItem]:
    """Parse a list of skill objects from the AI response."""
    if not raw or not isinstance(raw, list):
        return []
    result = []
    for item in raw:
        if isinstance(item, dict):
            result.append(
                SkillItem(
                    name=item.get("name", ""),
                    description=item.get("description"),
                )
            )
        elif isinstance(item, str):
            result.append(SkillItem(name=item, description=None))
    return result


def _parse_education(raw: list | None) -> list[EducationItem]:
    """Parse a list of education items from the AI response."""
    if not raw or not isinstance(raw, list):
        return []
    result = []
    for item in raw:
        if isinstance(item, dict):
            result.append(
                EducationItem(
                    level=item.get("level"),
                    field=item.get("field"),
                    description=item.get("description"),
                )
            )
        elif isinstance(item, str):
            result.append(EducationItem(description=item))
    return result


def _parse_years_experience(raw: dict | None) -> Optional[YearsExperience]:
    """Parse years of experience from the AI response."""
    if not raw or not isinstance(raw, dict):
        return None
    return YearsExperience(
        minimum=raw.get("minimum"),
        preferred=raw.get("preferred"),
        description=raw.get("description"),
    )


def _parse_certifications(raw: list | None) -> list[CertificationItem]:
    """Parse a list of certifications from the AI response."""
    if not raw or not isinstance(raw, list):
        return []
    result = []
    for item in raw:
        if isinstance(item, dict):
            result.append(
                CertificationItem(
                    name=item.get("name", ""),
                    required_or_preferred=item.get("required_or_preferred"),
                )
            )
        elif isinstance(item, str):
            result.append(CertificationItem(name=item))
    return result


def _parse_location_requirements(raw: dict | None) -> Optional[LocationRequirements]:
    """Parse location requirements from the AI response."""
    if not raw or not isinstance(raw, dict):
        return None
    return LocationRequirements(
        location=raw.get("location"),
        remote_policy=raw.get("remote_policy"),
        travel_requirements=raw.get("travel_requirements"),
    )


def _parse_keywords(raw: list | None) -> list[str]:
    """Parse keywords from the AI response."""
    if not raw or not isinstance(raw, list):
        return []
    return [str(k) for k in raw if k]


def parse_extraction_response(ai_response: AIServiceResponse) -> JDExtractionResponse:
    """Parse an AIServiceResponse into a structured JDExtractionResponse.

    Handles cases where the AI returns partial data or unexpected formats
    by providing sensible defaults for missing fields.
    """
    content = ai_response.content or {}

    categories = ExtractedCategories(
        required_skills=_parse_skills(content.get("required_skills")),
        preferred_skills=_parse_skills(content.get("preferred_skills")),
        education=_parse_education(content.get("education")),
        years_experience=_parse_years_experience(content.get("years_experience")),
        certifications=_parse_certifications(content.get("certifications")),
        location_requirements=_parse_location_requirements(
            content.get("location_requirements")
        ),
        keywords=_parse_keywords(content.get("keywords")),
    )

    return JDExtractionResponse(
        categories=categories,
        confidence=ai_response.confidence.value,
    )


async def extract_job_description(
    text: str,
    *,
    ai_service: AIService,
    db: Optional[AsyncSession] = None,
    organization_id: Optional[uuid.UUID] = None,
    hiring_project_id: Optional[uuid.UUID] = None,
) -> JDExtractionResponse:
    """Extract structured requirements from job description text.

    Calls AIService with PromptType.JOB_DESCRIPTION and parses the response
    into categorized extraction data for user review.

    Args:
        text: The raw job description text to extract from.
        ai_service: The AIService instance to use.
        db: Optional database session for storing the AI response.
        organization_id: Organization context for auditability.
        hiring_project_id: Optional hiring project context.

    Returns:
        JDExtractionResponse with extracted categories and confidence level.

    Raises:
        ValueError: If the AI service returns an error response.
    """
    ai_response = await ai_service.call(
        prompt_type=PromptType.JOB_DESCRIPTION,
        user_content=text,
        db=db,
        organization_id=organization_id,
        hiring_project_id=hiring_project_id,
    )

    if ai_response.error:
        raise ValueError(f"AI extraction failed: {ai_response.error}")

    return parse_extraction_response(ai_response)
