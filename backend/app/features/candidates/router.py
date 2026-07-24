"""API routes for Candidates.

Endpoints:
- GET /api/v1/projects/{project_id}/candidates — List candidates (paginated, filtered, sorted by score DESC)
- GET /api/v1/candidates/{candidate_id} — Get full candidate profile
- POST /api/v1/candidates/{candidate_id}/hire — Mark candidate as hired

Requirements: 10.1, 10.6, 10.7, 11.1, 14.1, 14.2, 14.3, 14.7, 19.5
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_db
from app.core.middleware.auth import AuthenticatedUser, get_current_user
from app.features.candidates.schemas import (
    CandidateCardResponse,
    CandidateListResponse,
    CandidateProfileResponse,
    ConfidenceLevel,
    HireCandidateResponse,
)
from app.features.candidates.service import CandidateService

# Router for project-scoped candidate list
candidates_list_router = APIRouter(
    prefix="/projects/{project_id}/candidates",
    tags=["Candidates"],
)

# Router for candidate profile (not project-scoped in URL)
candidates_profile_router = APIRouter(
    prefix="/candidates",
    tags=["Candidates"],
)


def _get_service(session: AsyncSession = Depends(get_db)) -> CandidateService:
    """Dependency to create CandidateService with the current session."""
    return CandidateService(session)


@candidates_list_router.get("", response_model=CandidateListResponse)
async def list_candidates(
    project_id: UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=50, description="Items per page (max 50)"),
    min_score: Optional[int] = Query(
        None, ge=0, le=100, description="Minimum match score (0-100)"
    ),
    max_score: Optional[int] = Query(
        None, ge=0, le=100, description="Maximum match score (0-100)"
    ),
    confidence: Optional[ConfidenceLevel] = Query(
        None, description="Filter by confidence level"
    ),
    user: AuthenticatedUser = Depends(get_current_user),
    service: CandidateService = Depends(_get_service),
) -> CandidateListResponse:
    """List candidates for a hiring project.

    Returns candidates sorted by Match_Score descending with pagination.
    Supports filtering by score range and confidence level.
    """
    result = await service.list_candidates(
        project_id=project_id,
        page=page,
        page_size=page_size,
        min_score=min_score,
        max_score=max_score,
        confidence=confidence.value if confidence else None,
    )

    # Build card responses with truncated summaries
    items = [
        CandidateCardResponse(
            id=c.id,
            full_name=c.full_name,
            current_company=c.current_company,
            location=c.location,
            years_experience=c.years_experience,
            match_score=c.match_score,
            confidence_level=c.confidence_level,
            summary=CandidateService.truncate_summary(c.summary),
            processing_status=c.processing_status,
        )
        for c in result.items
    ]

    return CandidateListResponse(
        items=items,
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
        has_next=result.has_next,
        has_previous=result.has_previous,
    )


@candidates_profile_router.get(
    "/{candidate_id}", response_model=CandidateProfileResponse
)
async def get_candidate_profile(
    candidate_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    service: CandidateService = Depends(_get_service),
) -> CandidateProfileResponse:
    """Get a full candidate profile.

    Returns all candidate fields including parsed data, AI-generated
    summary, strengths, concerns, and interview questions.
    Returns 404 if the candidate does not exist or belongs to a different org.
    """
    candidate = await service.get_candidate_profile(candidate_id)
    return CandidateProfileResponse.model_validate(candidate)


@candidates_profile_router.post(
    "/{candidate_id}/hire", response_model=HireCandidateResponse
)
async def hire_candidate(
    candidate_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    service: CandidateService = Depends(_get_service),
) -> HireCandidateResponse:
    """Mark a candidate as hired.

    Updates the candidate's status to 'hired'. Returns 409 if the
    project is in Filled or Archived state. On success, includes a
    `project_fillable` flag indicating whether the frontend should
    prompt the user to close the hiring project.
    """
    result = await service.hire_candidate(candidate_id)
    return HireCandidateResponse(
        candidate=CandidateProfileResponse.model_validate(result.candidate),
        project_fillable=result.project_fillable,
    )
