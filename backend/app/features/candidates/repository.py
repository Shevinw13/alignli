"""Repository for Candidate database access.

Extends BaseRepository with candidate-specific query logic including
filtering by score range and confidence level, and ordering by match_score DESC.

All queries are automatically org-scoped and soft-delete filtered.

Requirements: 10.1, 10.6, 10.7, 11.1, 19.5
"""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy import Select, func, select

from app.core.database.repository import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    BaseRepository,
    PaginatedResult,
)
from app.models.candidates import Candidate


class CandidateRepository(BaseRepository[Candidate]):
    """Repository for Candidate CRUD operations.

    Inherits org-scoping and soft-delete filtering from BaseRepository.
    Adds project-scoped queries and filtering capabilities.
    """

    model = Candidate

    def _project_query(self, project_id: UUID) -> Select:
        """Build a query scoped to a specific hiring project.

        Combines base org-scoping/soft-delete with project filtering.
        """
        return self._base_query().where(
            Candidate.hiring_project_id == project_id
        )

    async def list_by_project(
        self,
        project_id: UUID,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        min_score: Optional[int] = None,
        max_score: Optional[int] = None,
        confidence: Optional[str] = None,
    ) -> PaginatedResult[Candidate]:
        """List candidates for a project, filtered and sorted by score DESC.

        Args:
            project_id: UUID of the hiring project.
            page: Page number (1-indexed). Defaults to 1.
            page_size: Items per page. Defaults to 25, max 50.
            min_score: Minimum match_score filter (0-100).
            max_score: Maximum match_score filter (0-100).
            confidence: Confidence level filter (High, Medium, Low).

        Returns:
            PaginatedResult with candidates and pagination metadata.
        """
        # Enforce page size limits
        page_size = min(max(1, page_size), MAX_PAGE_SIZE)
        page = max(1, page)

        # Build filtered query
        query = self._project_query(project_id)

        if min_score is not None:
            query = query.where(Candidate.match_score >= min_score)
        if max_score is not None:
            query = query.where(Candidate.match_score <= max_score)
        if confidence is not None:
            query = query.where(Candidate.confidence_level == confidence)

        # Get total count with filters applied
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Order by match_score descending (NULLs last)
        query = query.order_by(
            Candidate.match_score.desc().nulls_last(),
            Candidate.created_at.desc(),
        )

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        result = await self.session.execute(query)
        items = list(result.scalars().all())

        return PaginatedResult(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_by_id(self, candidate_id: UUID) -> Optional[Candidate]:
        """Get a single candidate by ID, org-scoped.

        Returns None if not found or belongs to a different org.
        """
        return await self.get(candidate_id)
