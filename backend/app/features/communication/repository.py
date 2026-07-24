"""Repository for CandidateCommunication database access.

Extends BaseRepository with communication-specific query logic including
listing by project ordered by most recent first.

All queries are automatically org-scoped.

Requirements: 13.1, 13.3
"""

from __future__ import annotations

from typing import Sequence
from uuid import UUID

from sqlalchemy import select

from app.core.database.repository import BaseRepository
from app.models.candidate_communications import CandidateCommunication


class CommunicationRepository(BaseRepository[CandidateCommunication]):
    """Repository for CandidateCommunication CRUD operations.

    Inherits org-scoping from BaseRepository.
    """

    model = CandidateCommunication

    async def list_by_project(
        self,
        project_id: UUID,
    ) -> Sequence[CandidateCommunication]:
        """List communications for a hiring project, ordered by most recent first.

        Args:
            project_id: UUID of the hiring project.

        Returns:
            List of communications ordered by sent_at DESC (or created_at DESC).
        """
        query = self._base_query().where(
            CandidateCommunication.hiring_project_id == project_id
        )

        # Order by sent_at descending, falling back to created_at for unsent
        query = query.order_by(
            CandidateCommunication.sent_at.desc().nulls_last(),
            CandidateCommunication.created_at.desc(),
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())
