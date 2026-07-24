"""Tests for Hiring Project CRUD endpoints.

Tests cover:
- Project creation with validation (title, location, employment_type, remote_preference)
- All new projects start in Draft state
- Project listing with pagination and org-scoping
- Project detail retrieval
- Error responses (400, 404)

Requirements: 3.1, 3.2, 3.4, 3.5, 3.6
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.database.session import set_current_org_id
from app.core.middleware.auth import AuthenticatedUser
from app.features.hiring_projects.schemas import (
    EmploymentType,
    ProjectCreateRequest,
    RemotePreference,
)
from app.features.hiring_projects.service import HiringProjectService
from app.main import app

# --- Fixtures ---

TEST_ORG_ID = str(uuid.uuid4())
TEST_USER_ID = "user_test_123"
TEST_MANAGER_ID = str(uuid.uuid4())


def _mock_user() -> AuthenticatedUser:
    """Create a mock authenticated user."""
    return AuthenticatedUser(
        user_id=TEST_USER_ID,
        org_id=TEST_ORG_ID,
        role="Hiring_Manager",
    )


def _mock_project(
    project_id: uuid.UUID | None = None,
    title: str = "Software Engineer",
    location: str = "New York",
    employment_type: str = "Full-time",
    remote_preference: str = "Hybrid",
    state: str = "Draft",
) -> MagicMock:
    """Create a mock HiringProject object."""
    project = MagicMock()
    project.id = project_id or uuid.uuid4()
    project.organization_id = uuid.UUID(TEST_ORG_ID)
    project.title = title
    project.location = location
    project.employment_type = employment_type
    project.remote_preference = remote_preference
    project.assigned_manager_id = uuid.UUID(TEST_MANAGER_ID)
    project.state = state
    project.created_at = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
    project.updated_at = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
    return project


CSRF_TOKEN = "test-csrf-token-for-testing"


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a test client with mocked auth and db dependencies."""
    from app.core.database.session import get_db
    from app.core.middleware.auth import get_current_user

    async def mock_get_db():
        """Mock database session that yields an AsyncMock."""
        yield AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    app.dependency_overrides[get_db] = mock_get_db
    set_current_org_id(TEST_ORG_ID)

    test_client = TestClient(app)
    # Set CSRF cookie so the middleware can validate
    test_client.cookies.set("csrf_token", CSRF_TOKEN)

    yield test_client

    app.dependency_overrides.clear()
    set_current_org_id(None)


@pytest.fixture
def valid_project_data() -> dict[str, Any]:
    """Valid project creation payload."""
    return {
        "title": "Software Engineer",
        "location": "New York",
        "employment_type": "Full-time",
        "remote_preference": "Hybrid",
        "assigned_manager_id": TEST_MANAGER_ID,
    }


# --- Schema Validation Tests ---


class TestProjectCreateRequestValidation:
    """Tests for ProjectCreateRequest schema validation."""

    def test_valid_input_accepted(self, valid_project_data: dict[str, Any]) -> None:
        """Valid input is accepted and parsed correctly."""
        req = ProjectCreateRequest(**valid_project_data)
        assert req.title == "Software Engineer"
        assert req.location == "New York"
        assert req.employment_type == EmploymentType.FULL_TIME
        assert req.remote_preference == RemotePreference.HYBRID
        assert req.assigned_manager_id == uuid.UUID(TEST_MANAGER_ID)

    def test_title_max_length_100(self) -> None:
        """Title exceeding 100 characters is rejected."""
        data = {
            "title": "x" * 101,
            "location": "NY",
            "employment_type": "Full-time",
            "remote_preference": "Remote",
            "assigned_manager_id": TEST_MANAGER_ID,
        }
        with pytest.raises(Exception):
            ProjectCreateRequest(**data)

    def test_title_exactly_100_accepted(self) -> None:
        """Title at exactly 100 characters is accepted."""
        data = {
            "title": "x" * 100,
            "location": "NY",
            "employment_type": "Full-time",
            "remote_preference": "Remote",
            "assigned_manager_id": TEST_MANAGER_ID,
        }
        req = ProjectCreateRequest(**data)
        assert len(req.title) == 100

    def test_location_max_length_100(self) -> None:
        """Location exceeding 100 characters is rejected."""
        data = {
            "title": "Engineer",
            "location": "x" * 101,
            "employment_type": "Full-time",
            "remote_preference": "Remote",
            "assigned_manager_id": TEST_MANAGER_ID,
        }
        with pytest.raises(Exception):
            ProjectCreateRequest(**data)

    def test_empty_title_rejected(self) -> None:
        """Empty title is rejected."""
        data = {
            "title": "",
            "location": "NY",
            "employment_type": "Full-time",
            "remote_preference": "Remote",
            "assigned_manager_id": TEST_MANAGER_ID,
        }
        with pytest.raises(Exception):
            ProjectCreateRequest(**data)

    def test_whitespace_only_title_rejected(self) -> None:
        """Whitespace-only title is rejected (sanitized then fails min_length)."""
        data = {
            "title": "   ",
            "location": "NY",
            "employment_type": "Full-time",
            "remote_preference": "Remote",
            "assigned_manager_id": TEST_MANAGER_ID,
        }
        with pytest.raises(Exception):
            ProjectCreateRequest(**data)

    def test_invalid_employment_type_rejected(self) -> None:
        """Invalid employment type is rejected."""
        data = {
            "title": "Engineer",
            "location": "NY",
            "employment_type": "Freelance",
            "remote_preference": "Remote",
            "assigned_manager_id": TEST_MANAGER_ID,
        }
        with pytest.raises(Exception):
            ProjectCreateRequest(**data)

    def test_invalid_remote_preference_rejected(self) -> None:
        """Invalid remote preference is rejected."""
        data = {
            "title": "Engineer",
            "location": "NY",
            "employment_type": "Full-time",
            "remote_preference": "Flexible",
            "assigned_manager_id": TEST_MANAGER_ID,
        }
        with pytest.raises(Exception):
            ProjectCreateRequest(**data)

    def test_invalid_uuid_rejected(self) -> None:
        """Invalid UUID for assigned_manager_id is rejected."""
        data = {
            "title": "Engineer",
            "location": "NY",
            "employment_type": "Full-time",
            "remote_preference": "Remote",
            "assigned_manager_id": "not-a-uuid",
        }
        with pytest.raises(Exception):
            ProjectCreateRequest(**data)

    def test_html_stripped_from_title(self) -> None:
        """HTML tags are stripped from title by SanitizedBaseModel."""
        data = {
            "title": "<script>alert('xss')</script>Engineer",
            "location": "NY",
            "employment_type": "Full-time",
            "remote_preference": "Remote",
            "assigned_manager_id": TEST_MANAGER_ID,
        }
        req = ProjectCreateRequest(**data)
        assert "<script>" not in req.title
        assert "Engineer" in req.title

    def test_all_employment_types_accepted(self) -> None:
        """All valid employment types are accepted."""
        for et in ["Full-time", "Part-time", "Contract", "Temporary"]:
            data = {
                "title": "Role",
                "location": "NY",
                "employment_type": et,
                "remote_preference": "Remote",
                "assigned_manager_id": TEST_MANAGER_ID,
            }
            req = ProjectCreateRequest(**data)
            assert req.employment_type.value == et

    def test_all_remote_preferences_accepted(self) -> None:
        """All valid remote preferences are accepted."""
        for rp in ["Remote", "Hybrid", "On-site"]:
            data = {
                "title": "Role",
                "location": "NY",
                "employment_type": "Full-time",
                "remote_preference": rp,
                "assigned_manager_id": TEST_MANAGER_ID,
            }
            req = ProjectCreateRequest(**data)
            assert req.remote_preference.value == rp


# --- Service Tests ---


class TestHiringProjectService:
    """Tests for HiringProjectService business logic."""

    @pytest.mark.asyncio
    async def test_create_project_sets_draft_state(self) -> None:
        """New projects always start in Draft state."""
        mock_session = AsyncMock()
        service = HiringProjectService(mock_session)

        mock_project = _mock_project(state="Draft")
        service.repository = AsyncMock()
        service.repository.create = AsyncMock(return_value=mock_project)

        data = ProjectCreateRequest(
            title="Engineer",
            location="NY",
            employment_type=EmploymentType.FULL_TIME,
            remote_preference=RemotePreference.REMOTE,
            assigned_manager_id=uuid.UUID(TEST_MANAGER_ID),
        )

        result = await service.create_project(data)

        # Verify state="Draft" was passed to repository.create
        service.repository.create.assert_called_once_with(
            title="Engineer",
            location="NY",
            employment_type="Full-time",
            remote_preference="Remote",
            assigned_manager_id=uuid.UUID(TEST_MANAGER_ID),
            state="Draft",
        )
        assert result.state == "Draft"

    @pytest.mark.asyncio
    async def test_get_project_not_found_raises(self) -> None:
        """Getting a non-existent project raises NotFoundException."""
        from app.core.security.exceptions import NotFoundException

        mock_session = AsyncMock()
        service = HiringProjectService(mock_session)
        service.repository = AsyncMock()
        service.repository.get = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await service.get_project(uuid.uuid4())

    @pytest.mark.asyncio
    async def test_list_projects_uses_updated_at_ordering(self) -> None:
        """Projects are listed sorted by updated_at descending."""
        mock_session = AsyncMock()
        service = HiringProjectService(mock_session)
        service.repository = AsyncMock()

        from app.core.database.repository import PaginatedResult

        mock_result = PaginatedResult(items=[], total=0, page=1, page_size=25)
        service.repository.list = AsyncMock(return_value=mock_result)

        await service.list_projects(page=1, page_size=25)

        # Verify list was called with order_by argument
        service.repository.list.assert_called_once()
        call_kwargs = service.repository.list.call_args[1]
        assert "order_by" in call_kwargs


# --- API Endpoint Tests ---


class TestCreateProjectEndpoint:
    """Tests for POST /api/v1/projects endpoint."""

    def test_create_project_returns_201(
        self, client: TestClient, valid_project_data: dict[str, Any]
    ) -> None:
        """Successful project creation returns 201."""
        with patch(
            "app.features.hiring_projects.service.HiringProjectService.create_project"
        ) as mock_create:
            mock_create.return_value = _mock_project()
            response = client.post(
                "/api/v1/projects",
                json=valid_project_data,
                headers={"x-csrf-token": CSRF_TOKEN},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["state"] == "Draft"
        assert data["title"] == "Software Engineer"

    def test_create_project_missing_title_returns_422(
        self, client: TestClient, valid_project_data: dict[str, Any]
    ) -> None:
        """Missing required field returns 422."""
        del valid_project_data["title"]
        response = client.post(
            "/api/v1/projects",
            json=valid_project_data,
            headers={"x-csrf-token": CSRF_TOKEN},
        )
        assert response.status_code == 422

    def test_create_project_invalid_employment_type_returns_422(
        self, client: TestClient, valid_project_data: dict[str, Any]
    ) -> None:
        """Invalid enum value returns 422."""
        valid_project_data["employment_type"] = "InvalidType"
        response = client.post(
            "/api/v1/projects",
            json=valid_project_data,
            headers={"x-csrf-token": CSRF_TOKEN},
        )
        assert response.status_code == 422

    def test_create_project_title_too_long_returns_422(
        self, client: TestClient, valid_project_data: dict[str, Any]
    ) -> None:
        """Title exceeding max length returns 422."""
        valid_project_data["title"] = "x" * 101
        response = client.post(
            "/api/v1/projects",
            json=valid_project_data,
            headers={"x-csrf-token": CSRF_TOKEN},
        )
        assert response.status_code == 422


class TestListProjectsEndpoint:
    """Tests for GET /api/v1/projects endpoint."""

    def test_list_projects_returns_200(self, client: TestClient) -> None:
        """Project list returns 200 with pagination metadata."""
        with patch(
            "app.features.hiring_projects.service.HiringProjectService.list_projects"
        ) as mock_list:
            from app.core.database.repository import PaginatedResult

            mock_list.return_value = PaginatedResult(
                items=[_mock_project()],
                total=1,
                page=1,
                page_size=25,
            )
            response = client.get("/api/v1/projects")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["page"] == 1
        assert data["page_size"] == 25
        assert len(data["items"]) == 1

    def test_list_projects_pagination_params(self, client: TestClient) -> None:
        """Custom pagination parameters are accepted."""
        with patch(
            "app.features.hiring_projects.service.HiringProjectService.list_projects"
        ) as mock_list:
            from app.core.database.repository import PaginatedResult

            mock_list.return_value = PaginatedResult(
                items=[], total=0, page=2, page_size=10
            )
            response = client.get("/api/v1/projects?page=2&page_size=10")

        assert response.status_code == 200
        mock_list.assert_called_once_with(page=2, page_size=10)

    def test_list_projects_page_size_max_50(self, client: TestClient) -> None:
        """Page size above 50 is rejected by query validation."""
        response = client.get("/api/v1/projects?page_size=51")
        assert response.status_code == 422


class TestGetProjectEndpoint:
    """Tests for GET /api/v1/projects/{id} endpoint."""

    def test_get_project_returns_200(self, client: TestClient) -> None:
        """Existing project returns 200 with full details."""
        project_id = uuid.uuid4()
        with patch(
            "app.features.hiring_projects.service.HiringProjectService.get_project"
        ) as mock_get:
            mock_get.return_value = _mock_project(project_id=project_id)
            response = client.get(f"/api/v1/projects/{project_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(project_id)
        assert data["state"] == "Draft"

    def test_get_project_not_found_returns_404(self, client: TestClient) -> None:
        """Non-existent project returns 404."""
        from app.core.security.exceptions import NotFoundException

        project_id = uuid.uuid4()
        with patch(
            "app.features.hiring_projects.service.HiringProjectService.get_project"
        ) as mock_get:
            mock_get.side_effect = NotFoundException(
                message="The requested project was not found"
            )
            response = client.get(f"/api/v1/projects/{project_id}")

        assert response.status_code == 404

    def test_get_project_invalid_uuid_returns_422(self, client: TestClient) -> None:
        """Invalid UUID in path returns 422."""
        response = client.get("/api/v1/projects/not-a-uuid")
        assert response.status_code == 422
