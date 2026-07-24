"""API routes for Resume Ingestion.

Endpoints:
- POST /api/v1/projects/{project_id}/resumes — Validate files and get signed upload URLs
- POST /api/v1/candidates/{candidate_id}/retry — Retry processing for a failed candidate

Requirements: 6.1, 6.2, 6.3, 6.5, 6.7, 6.8, 7.9
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_db
from app.core.middleware.auth import AuthenticatedUser, get_current_user
from app.core.security.exceptions import ValidationException
from app.features.ingestion.schemas import (
    ResumeUploadRequest,
    ResumeUploadResponse,
    RetryResponse,
)
from app.features.ingestion.service import MAX_BATCH_SIZE, IngestionService

router = APIRouter(
    prefix="/projects/{project_id}/resumes",
    tags=["Ingestion"],
)

# Separate router for candidate-level retry (not project-scoped in URL)
retry_router = APIRouter(
    prefix="/candidates",
    tags=["Ingestion"],
)


def _get_service(session: AsyncSession = Depends(get_db)) -> IngestionService:
    """Dependency to create IngestionService with the current session."""
    return IngestionService(session)


@router.post("", response_model=ResumeUploadResponse)
async def upload_resumes(
    project_id: UUID,
    request: ResumeUploadRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    service: IngestionService = Depends(_get_service),
) -> ResumeUploadResponse:
    """Validate resume files and generate signed upload URLs.

    Accepts a list of file metadata, validates each file (PDF only,
    max 10 MB), and returns signed Supabase Storage upload URLs for
    accepted files. Invalid files are rejected with specific reasons.

    Supports partial success: valid files are processed even if some
    files in the batch are invalid.

    Max 50 files per batch (enforced by request schema validation).
    """
    # Additional batch size validation (belt and suspenders with schema)
    if len(request.files) > MAX_BATCH_SIZE:
        raise ValidationException(
            message=f"Maximum {MAX_BATCH_SIZE} files per batch",
            details=[
                {
                    "field": "files",
                    "message": f"Batch size exceeds the limit of {MAX_BATCH_SIZE} files",
                }
            ],
        )

    return await service.validate_and_generate_upload_urls(
        project_id=project_id,
        files=request.files,
    )


@retry_router.post("/{candidate_id}/retry", response_model=RetryResponse)
async def retry_candidate(
    candidate_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    service: IngestionService = Depends(_get_service),
) -> RetryResponse:
    """Retry processing for a failed candidate.

    Re-triggers the full ingestion pipeline from the beginning for a
    candidate whose processing previously failed. The original uploaded
    file is preserved and reused.

    Only candidates with processing_status='processing_failed' can be retried.

    Args:
        candidate_id: UUID of the failed candidate to retry.
        user: Authenticated user making the request.
        service: Ingestion service instance.

    Returns:
        RetryResponse confirming retry was triggered.

    Raises:
        404: Candidate not found or belongs to different org.
        409: Candidate is not in a failed state.
    """
    return await service.retry_failed_candidate(candidate_id)
