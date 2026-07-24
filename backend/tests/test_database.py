"""Tests for database connection pool, session management, and repository pattern."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.core.database.session import (
    get_current_org_id,
    set_current_org_id,
    check_db_connection,
    _create_async_engine,
)
from app.core.database.repository import (
    BaseRepository,
    PaginatedResult,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
)


class TestOrgIdContext:
    """Tests for organization ID context variable management."""

    def test_default_org_id_is_none(self):
        """By default, org_id should be None."""
        # Reset context
        set_current_org_id(None)
        assert get_current_org_id() is None

    def test_set_and_get_org_id(self):
        """Setting org_id should be retrievable."""
        org_id = "org_123"
        set_current_org_id(org_id)
        assert get_current_org_id() == org_id
        # Cleanup
        set_current_org_id(None)

    def test_set_org_id_to_none(self):
        """Should be able to clear org_id by setting to None."""
        set_current_org_id("org_abc")
        assert get_current_org_id() == "org_abc"
        set_current_org_id(None)
        assert get_current_org_id() is None


class TestAsyncEngine:
    """Tests for async engine configuration."""

    def test_engine_pool_settings(self):
        """Engine should be configured with appropriate pool settings."""
        with patch("app.core.database.session.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                database_url="postgresql+asyncpg://localhost:5432/test",
                debug=False,
            )
            engine = _create_async_engine()
            assert engine.pool.size() == 20
            assert engine.pool._max_overflow == 30


class TestPaginatedResult:
    """Tests for PaginatedResult dataclass."""

    def test_empty_result(self):
        """Empty results should have correct metadata."""
        result = PaginatedResult(items=[], total=0, page=1, page_size=25)
        assert result.total_pages == 0
        assert result.has_next is False
        assert result.has_previous is False

    def test_single_page(self):
        """Single page results should show no next/previous."""
        result = PaginatedResult(items=["a", "b"], total=2, page=1, page_size=25)
        assert result.total_pages == 1
        assert result.has_next is False
        assert result.has_previous is False

    def test_multiple_pages_first_page(self):
        """First page of multi-page results should show has_next only."""
        result = PaginatedResult(items=["a"] * 25, total=75, page=1, page_size=25)
        assert result.total_pages == 3
        assert result.has_next is True
        assert result.has_previous is False

    def test_multiple_pages_middle_page(self):
        """Middle page should show both has_next and has_previous."""
        result = PaginatedResult(items=["a"] * 25, total=75, page=2, page_size=25)
        assert result.total_pages == 3
        assert result.has_next is True
        assert result.has_previous is True

    def test_multiple_pages_last_page(self):
        """Last page should show has_previous only."""
        result = PaginatedResult(items=["a"] * 25, total=75, page=3, page_size=25)
        assert result.total_pages == 3
        assert result.has_next is False
        assert result.has_previous is True

    def test_to_dict(self):
        """to_dict should serialize all pagination metadata."""
        result = PaginatedResult(items=["a"] * 25, total=100, page=2, page_size=25)
        d = result.to_dict()
        assert d == {
            "total": 100,
            "page": 2,
            "page_size": 25,
            "total_pages": 4,
            "has_next": True,
            "has_previous": True,
        }

    def test_page_size_boundary(self):
        """Total pages should round up correctly."""
        # 51 items with page size 25 = 3 pages
        result = PaginatedResult(items=[], total=51, page=1, page_size=25)
        assert result.total_pages == 3

        # 50 items with page size 25 = 2 pages exactly
        result = PaginatedResult(items=[], total=50, page=1, page_size=25)
        assert result.total_pages == 2


class TestDbHealthCheck:
    """Tests for database health check endpoint."""

    @pytest.mark.asyncio
    async def test_db_health_check_success(self):
        """Health check should return True when DB is connected."""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 1
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch(
            "app.core.database.session.async_session_factory"
        ) as mock_factory:
            mock_factory.return_value.__aenter__ = AsyncMock(
                return_value=mock_session
            )
            mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await check_db_connection()
            assert result is True

    @pytest.mark.asyncio
    async def test_db_health_check_failure(self):
        """Health check should return False when DB is unreachable."""
        with patch(
            "app.core.database.session.async_session_factory"
        ) as mock_factory:
            mock_factory.return_value.__aenter__ = AsyncMock(
                side_effect=Exception("Connection refused")
            )
            mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await check_db_connection()
            assert result is False


class TestDbHealthEndpoint:
    """Tests for the /health/db endpoint."""

    def test_health_endpoint_exists(self):
        """The /health/db endpoint should be registered."""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        # The endpoint exists but will fail since no real DB in tests
        response = client.get("/health/db")
        # Should return 503 (unhealthy) since no DB is running
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"


class TestBaseRepositoryPageSizeEnforcement:
    """Tests for BaseRepository page size constraints."""

    def test_default_page_size(self):
        """Default page size should be 25."""
        assert DEFAULT_PAGE_SIZE == 25

    def test_max_page_size(self):
        """Max page size should be 50."""
        assert MAX_PAGE_SIZE == 50
