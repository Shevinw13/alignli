"""API routes for Candidate Comparison.

Endpoints:
- POST /api/v1/candidates/compare — Compare 2-4 candidates side by side
- POST /api/v1/candidates/compare/summary — Generate AI comparison summary

Requirements: 12.1, 12.3, 12.4, 12.5, 12.6
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_db
from app.core.middleware.auth import AuthenticatedUser, get_current_user
from app.core.security.exceptions import ValidationException
from app.features.ai.comparison_summary import (
    ComparisonSummaryResponse,
    ComparisonSummaryService,
)
from app.features.comparison.schemas import CompareRequest, CompareResponse
from app.features.comparison.service import ComparisonService

router = APIRouter(
    prefix="/candidates",
    tags=["Comparison"],
)


def _get_service(session: AsyncSession = Depends(get_db)) -> ComparisonService:
    """Dependency to create ComparisonService with the current session."""
    return ComparisonService(session)


def _get_summary_service(session: AsyncSession = Depends(get_db)) -> ComparisonSummaryService:
    """Dependency to create ComparisonSummaryService with the current session."""
    return ComparisonSummaryService(session)


@router.post("/compare", response_model=CompareResponse)
async def compare_candidates(
    body: CompareRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    service: ComparisonService = Depends(_get_service),
) -> CompareResponse:
    """Compare 2-4 candidates side by side.

    Returns aligned criterion scores and comparison dimensions for
    each candidate. Rejects requests with fewer than 2 or more than
    4 candidate IDs.

    Returns 400 if the candidate count is not between 2 and 4.
    Returns 404 if any candidate is not found or belongs to a different org.
    """
    return await service.compare_candidates(body.candidate_ids)


@router.post("/compare/summary", response_model=ComparisonSummaryResponse)
async def generate_comparison_summary(
    body: CompareRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    service: ComparisonSummaryService = Depends(_get_summary_service),
) -> ComparisonSummaryResponse:
    """Generate an AI-powered evidence-based comparison summary.

    Accepts 2-4 candidate IDs, loads their profiles, and generates
    a narrative comparison referencing specific data points from
    candidate profiles. The AI references only extracted profile data,
    not just numeric scores.

    Must complete within 30 seconds.

    Returns 400 if the candidate count is not between 2 and 4.
    Returns 404 if any candidate is not found or belongs to a different org.

    Requirements: 12.3, 12.5, 12.6
    """
    org_id: uuid.UUID | None = None
    if user.org_id:
        org_id = uuid.UUID(user.org_id)

    return await service.generate_summary(
        candidate_ids=body.candidate_ids,
        organization_id=org_id,
    )
