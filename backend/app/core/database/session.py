"""Async SQLAlchemy connection pool and session management.

Provides:
- Async engine with connection pool sized for 1,000+ concurrent users
- Session factory with org_id injection for RLS enforcement
- FastAPI dependency for database sessions
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextvars import ContextVar
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

# Context variable to hold the current organization ID for RLS scoping.
# Set by the org-scoping middleware on each request.
_current_org_id: ContextVar[Optional[str]] = ContextVar("_current_org_id", default=None)


def get_current_org_id() -> Optional[str]:
    """Get the current organization ID from context."""
    return _current_org_id.get()


def set_current_org_id(org_id: Optional[str]) -> None:
    """Set the current organization ID in context."""
    _current_org_id.set(org_id)


def _create_async_engine() -> AsyncEngine:
    """Create the async SQLAlchemy engine with connection pooling.

    Pool is sized to support 1,000+ concurrent users:
    - pool_size=20: base number of persistent connections
    - max_overflow=30: additional connections under peak load
    - pool_pre_ping=True: validate connections before use
    - pool_recycle=3600: recycle connections hourly to avoid stale connections
    """
    settings = get_settings()
    return create_async_engine(
        settings.database_url,
        pool_size=20,
        max_overflow=30,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=settings.debug,
    )


async_engine = _create_async_engine()

async_session_factory = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides a database session.

    Injects the current org_id as a PostgreSQL session variable
    (`app.current_org_id`) on each connection for RLS enforcement.
    The session is committed on success and rolled back on exception.
    """
    async with async_session_factory() as session:
        try:
            # Inject org_id session variable for RLS policies
            org_id = get_current_org_id()
            if org_id:
                await session.execute(
                    text("SET LOCAL app.current_org_id = :org_id"),
                    {"org_id": org_id},
                )

            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def check_db_connection() -> bool:
    """Check if the database connection is healthy.

    Returns True if a simple query executes successfully.
    """
    try:
        async with async_session_factory() as session:
            result = await session.execute(text("SELECT 1"))
            return result.scalar() == 1
    except Exception:
        return False
