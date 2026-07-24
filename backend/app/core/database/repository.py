"""Base repository pattern with automatic org-scoping and soft-delete filtering.

Provides common CRUD operations that:
- Automatically filter by organization_id
- Automatically apply WHERE deleted_at IS NULL
- Support pagination (default page size 25, max 50)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Generic, Optional, Sequence, TypeVar
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.base import Base
from app.core.database.session import get_current_org_id

# Type variable for model classes
ModelT = TypeVar("ModelT", bound=Base)

# Pagination defaults
DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 50


class PaginatedResult(Generic[ModelT]):
    """Container for paginated query results."""

    def __init__(
        self,
        items: Sequence[ModelT],
        total: int,
        page: int,
        page_size: int,
    ) -> None:
        self.items = items
        self.total = total
        self.page = page
        self.page_size = page_size

    @property
    def total_pages(self) -> int:
        """Calculate total number of pages."""
        if self.total == 0:
            return 0
        return (self.total + self.page_size - 1) // self.page_size

    @property
    def has_next(self) -> bool:
        """Check if there is a next page."""
        return self.page < self.total_pages

    @property
    def has_previous(self) -> bool:
        """Check if there is a previous page."""
        return self.page > 1

    def to_dict(self) -> dict[str, Any]:
        """Serialize pagination metadata."""
        return {
            "total": self.total,
            "page": self.page,
            "page_size": self.page_size,
            "total_pages": self.total_pages,
            "has_next": self.has_next,
            "has_previous": self.has_previous,
        }


class BaseRepository(Generic[ModelT]):
    """Base repository with automatic org-scoping and soft-delete filtering.

    Subclasses must set `model` to the SQLAlchemy model class.

    All queries automatically:
    - Filter by organization_id matching the current session org
    - Exclude soft-deleted records (deleted_at IS NULL)
    """

    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _base_query(self) -> Select:
        """Build the base query with org-scoping and soft-delete filtering.

        Applies:
        - WHERE organization_id = current_org_id (if model has the column)
        - WHERE deleted_at IS NULL (if model has the column)
        """
        query = select(self.model)

        # Apply org-scoping if the model has an organization_id column
        if hasattr(self.model, "organization_id"):
            org_id = get_current_org_id()
            if org_id:
                query = query.where(
                    self.model.organization_id == org_id  # type: ignore[attr-defined]
                )

        # Apply soft-delete filtering if the model has a deleted_at column
        if hasattr(self.model, "deleted_at"):
            query = query.where(
                self.model.deleted_at.is_(None)  # type: ignore[attr-defined]
            )

        return query

    async def get(self, id: UUID) -> Optional[ModelT]:
        """Get a single record by ID, scoped to the current org.

        Returns None if not found or belongs to a different org.
        """
        query = self._base_query().where(
            self.model.id == id  # type: ignore[attr-defined]
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list(
        self,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        order_by: Any | None = None,
    ) -> PaginatedResult[ModelT]:
        """List records with pagination, scoped to the current org.

        Args:
            page: Page number (1-indexed). Defaults to 1.
            page_size: Items per page. Defaults to 25, max 50.
            order_by: SQLAlchemy ordering clause. Defaults to created_at desc.

        Returns:
            PaginatedResult with items, total count, and pagination metadata.
        """
        # Enforce page size limits
        page_size = min(max(1, page_size), MAX_PAGE_SIZE)
        page = max(1, page)

        # Get total count
        count_query = select(func.count()).select_from(
            self._base_query().subquery()
        )
        total_result = await self.session.execute(count_query)
        total = total_result.scalar() or 0

        # Build paginated query
        query = self._base_query()

        if order_by is not None:
            query = query.order_by(order_by)
        elif hasattr(self.model, "created_at"):
            query = query.order_by(
                self.model.created_at.desc()  # type: ignore[attr-defined]
            )

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

    async def create(self, **kwargs: Any) -> ModelT:
        """Create a new record, automatically setting organization_id.

        The organization_id is injected from the current session context
        if the model has the column and it's not explicitly provided.
        """
        # Auto-inject organization_id if applicable
        if hasattr(self.model, "organization_id") and "organization_id" not in kwargs:
            org_id = get_current_org_id()
            if org_id:
                kwargs["organization_id"] = org_id

        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def update(self, id: UUID, **kwargs: Any) -> Optional[ModelT]:
        """Update an existing record by ID, scoped to the current org.

        Returns None if the record is not found.
        Only updates provided fields (partial update).
        """
        instance = await self.get(id)
        if instance is None:
            return None

        for key, value in kwargs.items():
            if hasattr(instance, key):
                setattr(instance, key, value)

        # Update the updated_at timestamp if the model has it
        if hasattr(instance, "updated_at"):
            instance.updated_at = datetime.now(timezone.utc)  # type: ignore[assignment]

        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def soft_delete(self, id: UUID) -> Optional[ModelT]:
        """Soft-delete a record by setting deleted_at timestamp.

        Returns None if the record is not found.
        Returns the updated record if successful.
        """
        instance = await self.get(id)
        if instance is None:
            return None

        if hasattr(instance, "deleted_at"):
            instance.deleted_at = datetime.now(timezone.utc)  # type: ignore[assignment]
            await self.session.flush()
            await self.session.refresh(instance)
            return instance

        return None
