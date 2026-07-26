"""Business logic for Hiring Projects.

Handles project creation, listing, and retrieval with validation.

Requirements: 3.1, 3.2, 3.4, 3.5, 3.6
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.repository import PaginatedResult
from app.core.security.exceptions import NotFoundException
from app.features.hiring_projects.repository import HiringProjectRepository
from app.features.hiring_projects.schemas import ProjectCreateRequest
from app.models.hiring_projects import HiringProject


class HiringProjectService:
    """Service layer for hiring project operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = HiringProjectRepository(session)

    async def create_project(self, data: ProjectCreateRequest) -> HiringProject:
        """Create a new hiring project.

        All new projects start in 'Draft' state regardless of any input.

        Args:
            data: Validated project creation data.

        Returns:
            The created HiringProject instance.
        """
        project = await self.repository.create(
            title=data.title,
            location=data.location,
            employment_type=data.employment_type.value,
            remote_preference=data.remote_preference.value,
            assigned_manager_id=data.assigned_manager_id,
            state="Draft",
        )
        return project

    async def list_projects(
        self, page: int = 1, page_size: int = 25
    ) -> PaginatedResult[HiringProject]:
        """List projects for the current organization.

        Projects are sorted by most recently updated first.
        Results are paginated and org-scoped automatically.

        Args:
            page: Page number (1-indexed).
            page_size: Items per page (max 50).

        Returns:
            Paginated result with projects and metadata.
        """
        return await self.repository.list(
            page=page,
            page_size=page_size,
            order_by=HiringProject.updated_at.desc(),
        )

    async def get_project(self, project_id: UUID) -> HiringProject:
        """Get a single project by ID."""
        project = await self.repository.get(project_id)
        if project is None:
            raise NotFoundException(message="The requested project was not found")
        return project

    async def delete_project(self, project_id: UUID) -> None:
        """Soft-delete a project by ID."""
        result = await self.repository.soft_delete(project_id)
        if result is None:
            raise NotFoundException(message="The requested project was not found")
