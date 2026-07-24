"""Business logic for Candidates.

Handles candidate listing (with filters/pagination), profile retrieval,
and hire actions.

Requirements: 10.1, 10.6, 10.7, 11.1, 14.1, 14.2, 14.3, 14.7, 19.5
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.repository import PaginatedResult
from app.core.security.exceptions import ConflictException, NotFoundException, ValidationException
from app.features.candidates.repository import CandidateRepository
from app.features.candidates.schemas import CandidateCardResponse
from app.features.hiring_projects.repository import HiringProjectRepository
from app.features.hiring_projects.state_machine import ProjectState, VALID_TRANSITIONS
from app.models.candidates import Candidate


@dataclass
class HireResult:
    """Result of a hire candidate operation."""

    candidate: Candidate
    project_fillable: bool


class CandidateService:
    """Service layer for candidate operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = CandidateRepository(session)

    async def list_candidates(
        self,
        project_id: UUID,
        page: int = 1,
        page_size: int = 25,
        min_score: Optional[int] = None,
        max_score: Optional[int] = None,
        confidence: Optional[str] = None,
    ) -> PaginatedResult[Candidate]:
        """List candidates for a project, sorted by match_score descending.

        Applies optional filters for score range and confidence level.
        Results are paginated (default 25, max 50 per page).

        Args:
            project_id: UUID of the hiring project.
            page: Page number (1-indexed).
            page_size: Items per page (default 25, max 50).
            min_score: Minimum match_score filter (0-100).
            max_score: Maximum match_score filter (0-100).
            confidence: Confidence level filter (High, Medium, Low).

        Returns:
            Paginated result with candidates and metadata.

        Raises:
            ValidationException: If min_score > max_score.
        """
        # Validate score range consistency
        if min_score is not None and max_score is not None and min_score > max_score:
            raise ValidationException(
                message="min_score cannot be greater than max_score",
                details=[
                    {
                        "field": "min_score",
                        "message": "min_score must be less than or equal to max_score",
                    }
                ],
            )

        return await self.repository.list_by_project(
            project_id=project_id,
            page=page,
            page_size=page_size,
            min_score=min_score,
            max_score=max_score,
            confidence=confidence,
        )

    async def get_candidate_profile(self, candidate_id: UUID) -> Candidate:
        """Get a full candidate profile by ID.

        The repository automatically applies org-scoping, so cross-org
        access returns None (which we convert to a 404).

        Args:
            candidate_id: UUID of the candidate to retrieve.

        Returns:
            The Candidate instance with all fields.

        Raises:
            NotFoundException: If candidate not found or belongs to different org.
        """
        candidate = await self.repository.get_by_id(candidate_id)
        if candidate is None:
            raise NotFoundException(
                message="The requested candidate was not found"
            )
        return candidate

    @staticmethod
    def truncate_summary(summary: Optional[str], max_length: int = 150) -> Optional[str]:
        """Truncate summary to a maximum length for card display.

        Args:
            summary: Full summary text.
            max_length: Maximum characters to return (default 150).

        Returns:
            Truncated summary or None if no summary.
        """
        if summary is None:
            return None
        if len(summary) <= max_length:
            return summary
        return summary[:max_length]

    async def hire_candidate(self, candidate_id: UUID) -> HireResult:
        """Mark a candidate as hired.

        Validates that the candidate's project is not in Filled or Archived state
        before allowing the hire action. On success, returns the updated candidate
        along with a flag indicating whether the project can transition to Filled.

        Args:
            candidate_id: UUID of the candidate to hire.

        Returns:
            HireResult with the updated candidate and project_fillable flag.

        Raises:
            NotFoundException: If candidate not found or belongs to different org.
            ConflictException: If the project is in Filled or Archived state.
        """
        # Fetch the candidate
        candidate = await self.repository.get_by_id(candidate_id)
        if candidate is None:
            raise NotFoundException(
                message="The requested candidate was not found"
            )

        # Fetch the associated hiring project
        project_repo = HiringProjectRepository(self.session)
        project = await project_repo.get(candidate.hiring_project_id)
        if project is None:
            raise NotFoundException(
                message="The requested project was not found"
            )

        # Block hire on Filled or Archived projects
        if project.state in (ProjectState.FILLED, ProjectState.ARCHIVED):
            raise ConflictException(
                message="The project is no longer accepting candidates"
            )

        # Update candidate status to hired
        candidate.status = "hired"
        candidate.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]
        await self.session.flush()
        await self.session.refresh(candidate)

        # Determine if project can transition to Filled
        # The project is fillable if "Filled" is a valid transition from its current state
        valid_targets = VALID_TRANSITIONS.get(project.state, set())
        project_fillable = ProjectState.FILLED in valid_targets

        return HireResult(candidate=candidate, project_fillable=project_fillable)
