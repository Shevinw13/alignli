"""Repository for Hiring Project database access.

Extends BaseRepository with project-specific query logic.
All queries are automatically org-scoped and soft-delete filtered.

Requirements: 3.1, 3.2, 3.4
"""

from __future__ import annotations

from app.core.database.repository import BaseRepository
from app.models.hiring_projects import HiringProject


class HiringProjectRepository(BaseRepository[HiringProject]):
    """Repository for HiringProject CRUD operations.

    Inherits org-scoping and soft-delete filtering from BaseRepository.
    Projects are listed sorted by most recently updated first.
    """

    model = HiringProject
