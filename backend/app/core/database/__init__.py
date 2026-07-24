"""Database: connection pool, base models, session management, repository pattern."""

from app.core.database.base import Base, SoftDeleteMixin, TimestampMixin
from app.core.database.repository import BaseRepository, PaginatedResult
from app.core.database.session import (
    async_engine,
    async_session_factory,
    check_db_connection,
    get_current_org_id,
    get_db,
    set_current_org_id,
)

__all__ = [
    "Base",
    "BaseRepository",
    "PaginatedResult",
    "SoftDeleteMixin",
    "TimestampMixin",
    "async_engine",
    "async_session_factory",
    "check_db_connection",
    "get_current_org_id",
    "get_db",
    "set_current_org_id",
]
