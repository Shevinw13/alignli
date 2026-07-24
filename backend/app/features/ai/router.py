"""API routes for AI features.

Endpoints:
- POST /api/v1/projects/{project_id}/extract-jd — Extract structured data from a job description
- POST /api/v1/projects/{project_id}/generate-criteria — Generate ranking criteria from extracted JD
- GET /api/v1/projects/{project_id}/brief — Generate AI Brief for a project

Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 9.2, 9.3, 9.4, 9.5
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_db
from app.core.middleware.auth import AuthenticatedUser, get_current_user
from app.features.ai.brief_generation import BriefResponse, generate_brief
from app.features.ai.criteria_generation import (
    CriteriaGenerationError,
    CriteriaGenerationResult,
    RankingCriterionResult,
    generate_ranking_criteria,
)
from app.features.ai.jd_extraction import extract_job_description
from app.features.ai.schemas import JDExtractionRequest, JDExtractionResponse
from app.features.ai.service import AIService

router = APIRouter(tags=["AI"])

# Shared AIService instance
_ai_service: AIService | None = None


def get_ai_service() -> AIService:
    """Get or create a shared AIService instance.
    
    This is a FastAPI dependency that can be overridden in tests.
    """
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service


# Alias for backward compatibility
_get_ai_service = get_ai_service


@router.post(
    "/projects/{project_id}/extract-jd",
    response_model=JDExtractionResponse,
    summary="Extract structured data from a job description",
    description=(
        "Accepts job description text and returns extracted structured data "
        "grouped by category (Required Skills, Preferred Skills, Education, "
        "Years of Experience, Certifications, Location Requirements, Keywords) "
        "for user review."
    ),
)
async def extract_jd(
    project_id: UUID,
    data: JDExtractionRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service),
) -> JDExtractionResponse:
    """Extract structured requirements from a job description.

    The endpoint accepts job description text (up to 50,000 characters)
    and uses the AI engine to extract information into categorized groups.

    Requirements: 4.1, 4.2, 4.3, 4.4
    """
    # Validate that at least text is provided
    if not data.text and not data.file_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Either text or file_url must be provided",
                    "details": [
                        {
                            "field": "text",
                            "message": "Job description text is required when file_url is not provided",
                        }
                    ],
                }
            },
        )

    # Validate minimum text length (requirement 4.6)
    text = data.text or ""
    if data.text and len(data.text.strip()) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Job description text is too short for extraction",
                    "details": [
                        {
                            "field": "text",
                            "message": "Text must contain at least 50 characters",
                        }
                    ],
                }
            },
        )

    # For file_url, we would fetch and extract text from the file.
    # For now, only text paste is supported.
    if data.file_url and not data.text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "File URL processing is not yet supported. Please paste the job description text.",
                    "details": [
                        {
                            "field": "file_url",
                            "message": "File upload extraction not yet implemented",
                        }
                    ],
                }
            },
        )

    # Determine organization_id from the authenticated user
    org_id = None
    if user.org_id:
        try:
            from uuid import UUID as UUIDType
            org_id = UUIDType(user.org_id)
        except (ValueError, TypeError):
            pass

    try:
        result = await extract_job_description(
            text=text,
            ai_service=ai_service,
            db=db,
            organization_id=org_id,
            hiring_project_id=project_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": {
                    "code": "AI_EXTRACTION_FAILED",
                    "message": str(e),
                    "details": [],
                }
            },
        ) from e

    return result


@router.get(
    "/projects/{project_id}/brief",
    response_model=BriefResponse,
    summary="Generate AI Brief for a hiring project",
    description=(
        "Returns a project overview containing: total candidate count, "
        "score distribution, top 3 candidates, up to 3 patterns, "
        "recommended action, and a summary narrative. "
        "For projects with zero candidates, returns a minimal response "
        "without calling the AI service."
    ),
)
async def get_project_brief(
    project_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service),
) -> BriefResponse:
    """Generate an AI Brief for a hiring project.

    Loads all candidates for the project, compiles stats, and calls
    AIService with PromptType.AI_BRIEF to generate the brief.

    For zero candidates: returns {"total_candidates": 0, "summary": "No candidates have been added yet."}
    without calling AI.

    Requirements: 9.2, 9.3, 9.4, 9.5
    """
    org_id = None
    if user.org_id:
        try:
            org_id = UUID(user.org_id)
        except (ValueError, TypeError):
            pass

    return await generate_brief(
        project_id=project_id,
        session=session,
        ai_service=ai_service,
        organization_id=org_id,
    )


# --- Ranking Criteria Generation ---


class GenerateCriteriaRequest(BaseModel):
    """Request schema for generating ranking criteria from extracted JD."""

    extracted_jd: dict[str, Any] = Field(
        ...,
        description="The extracted job description categories (from JD extraction step)",
    )


class GenerateCriteriaResponse(BaseModel):
    """Response schema for generated ranking criteria."""

    criteria: list[RankingCriterionResult] = Field(
        ...,
        description="List of AI-generated ranking criteria",
    )


@router.post(
    "/projects/{project_id}/generate-criteria",
    response_model=GenerateCriteriaResponse,
    summary="Generate ranking criteria from extracted job description",
    description=(
        "Accepts the extracted JD data and returns AI-suggested ranking criteria. "
        "Each criterion includes a category, label, priority (Low/Medium/High), "
        "and max_score (1-100). Generation completes within 10 seconds."
    ),
)
async def generate_criteria(
    project_id: UUID,
    data: GenerateCriteriaRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service),
) -> GenerateCriteriaResponse:
    """Generate AI-suggested ranking criteria from extracted job description.

    Accepts the extracted JD data (the categorized extraction from task 9.2)
    and returns AI-suggested ranking criteria for the user to review and customize.

    Requirements: 5.1, 5.2
    """
    org_id = None
    if user.org_id:
        try:
            org_id = UUID(user.org_id)
        except (ValueError, TypeError):
            pass

    try:
        result: CriteriaGenerationResult = await generate_ranking_criteria(
            extracted_jd=data.extracted_jd,
            ai_service=ai_service,
            db=db,
            organization_id=org_id,
            hiring_project_id=project_id,
        )
    except CriteriaGenerationError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": {
                    "code": "AI_GENERATION_FAILED",
                    "message": e.message,
                    "details": e.ai_error,
                }
            },
        ) from e

    return GenerateCriteriaResponse(criteria=result.criteria)
