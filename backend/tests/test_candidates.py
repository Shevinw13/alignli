"""Tests for Candidate list and profile endpoints.

Tests cover:
- Candidate list endpoint with pagination, sorting by match_score DESC
- Filter by score range (min/max 0-100) and confidence level (High/Medium/Low)
- Candidate profile endpoint returning full candidate data
- Summary truncation to 150 characters for card display
- Error responses (400, 404, 422)

Requirements: 10.1, 10.6, 10.7, 11.1, 19.5
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.database.repository import PaginatedResult
from app.core.database.session import set_current_org_id
from app.core.middleware.auth import AuthenticatedUser
from app.core.security.exceptions import NotFoundException, ValidationException
from app.features.candidates.schemas import (
    CandidateCardResponse,
    CandidateProfileResponse,
    ConfidenceLevel,
)
from app.features.candidates.service import CandidateService
from app.main import app

# --- Constants ---

TEST_ORG_ID = str(uuid.uuid4())
TEST_USER_ID = "user_test_candidates_123"
TEST_PROJECT_ID = uuid.uuid4()

CSRF_TOKEN = "test-csrf-token-for-testing"


# --- Helpers ---


def _mock_user() -> AuthenticatedUser:
    """Create a mock authenticated user."""
    return AuthenticatedUser(
        user_id=TEST_USER_ID,
        org_id=TEST_ORG_ID,
        role="Hiring_Manager",
    )


def _mock_candidate(
    candidate_id: uuid.UUID | None = None,
    full_name: str = "Jane Smith",
    current_company: str = "Acme Corp",
    location: str = "San Francisco",
    years_experience: int = 5,
    match_score: int = 85,
    confidence_level: str = "High",
    processing_status: str = "completed",
    status: str = "active",
    summary: str = "An experienced engineer with strong skills in Python and cloud.",
    parsed_data: dict | None = None,
    strengths: list | None = None,
    concerns: list | None = None,
    interview_questions: list | None = None,
) -> MagicMock:
    """Create a mock Candidate object."""
    candidate = MagicMock()
    candidate.id = candidate_id or uuid.uuid4()
    candidate.hiring_project_id = TEST_PROJECT_ID
    candidate.organization_id = uuid.UUID(TEST_ORG_ID)
    candidate.full_name = full_name
    candidate.email = "jane@example.com"
    candidate.phone = "+1-555-0123"
    candidate.linkedin_url = "https://linkedin.com/in/janesmith"
    candidate.github_url = "https://github.com/janesmith"
    candidate.portfolio_url = "https://janesmith.dev"
    candidate.website_url = None
    candidate.current_company = current_company
    candidate.location = location
    candidate.years_experience = years_experience
    candidate.match_score = match_score
    candidate.confidence_level = confidence_level
    candidate.processing_status = processing_status
    candidate.status = status
    candidate.parsed_data = parsed_data or {"experience": [], "education": []}
    candidate.summary = summary
    candidate.strengths = strengths or ["Strong Python skills", "Cloud expertise"]
    candidate.concerns = concerns or ["Short tenure at last role"]
    candidate.interview_questions = interview_questions or [
        "Tell me about your cloud experience"
    ]
    candidate.created_at = datetime(2024, 1, 20, 10, 0, 0, tzinfo=timezone.utc)
    candidate.updated_at = datetime(2024, 1, 20, 10, 0, 0, tzinfo=timezone.utc)
    return candidate


# --- Fixtures ---


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a test client with mocked auth and db dependencies."""
    from app.core.database.session import get_db
    from app.core.middleware.auth import get_current_user

    async def mock_get_db():
        yield AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    app.dependency_overrides[get_db] = mock_get_db
    set_current_org_id(TEST_ORG_ID)

    test_client = TestClient(app)
    test_client.cookies.set("csrf_token", CSRF_TOKEN)

    yield test_client

    app.dependency_overrides.clear()
    set_current_org_id(None)


# --- Service Unit Tests ---


class TestCandidateService:
    """Tests for CandidateService business logic."""

    @pytest.mark.asyncio
    async def test_list_candidates_calls_repository(self) -> None:
        """list_candidates delegates to repository with correct params."""
        mock_session = AsyncMock()
        service = CandidateService(mock_session)
        service.repository = AsyncMock()

        mock_result = PaginatedResult(items=[], total=0, page=1, page_size=25)
        service.repository.list_by_project = AsyncMock(return_value=mock_result)

        result = await service.list_candidates(
            project_id=TEST_PROJECT_ID,
            page=2,
            page_size=10,
            min_score=50,
            max_score=90,
            confidence="High",
        )

        service.repository.list_by_project.assert_called_once_with(
            project_id=TEST_PROJECT_ID,
            page=2,
            page_size=10,
            min_score=50,
            max_score=90,
            confidence="High",
        )
        assert result.total == 0

    @pytest.mark.asyncio
    async def test_list_candidates_min_score_greater_than_max_raises(self) -> None:
        """min_score > max_score raises ValidationException."""
        mock_session = AsyncMock()
        service = CandidateService(mock_session)

        with pytest.raises(ValidationException):
            await service.list_candidates(
                project_id=TEST_PROJECT_ID,
                min_score=80,
                max_score=50,
            )

    @pytest.mark.asyncio
    async def test_get_candidate_profile_not_found_raises(self) -> None:
        """Getting a non-existent candidate raises NotFoundException."""
        mock_session = AsyncMock()
        service = CandidateService(mock_session)
        service.repository = AsyncMock()
        service.repository.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await service.get_candidate_profile(uuid.uuid4())

    @pytest.mark.asyncio
    async def test_get_candidate_profile_returns_candidate(self) -> None:
        """Existing candidate is returned by the service."""
        mock_session = AsyncMock()
        service = CandidateService(mock_session)
        service.repository = AsyncMock()

        mock_candidate = _mock_candidate()
        service.repository.get_by_id = AsyncMock(return_value=mock_candidate)

        result = await service.get_candidate_profile(mock_candidate.id)
        assert result == mock_candidate


class TestTruncateSummary:
    """Tests for CandidateService.truncate_summary static method."""

    def test_none_returns_none(self) -> None:
        """None summary returns None."""
        assert CandidateService.truncate_summary(None) is None

    def test_short_summary_unchanged(self) -> None:
        """Summary under 150 chars is returned unchanged."""
        summary = "A short summary."
        assert CandidateService.truncate_summary(summary) == summary

    def test_exactly_150_chars_unchanged(self) -> None:
        """Summary at exactly 150 chars is returned unchanged."""
        summary = "x" * 150
        assert CandidateService.truncate_summary(summary) == summary

    def test_over_150_chars_truncated(self) -> None:
        """Summary over 150 chars is truncated to 150."""
        summary = "x" * 200
        result = CandidateService.truncate_summary(summary)
        assert len(result) == 150

    def test_empty_string(self) -> None:
        """Empty string returns empty string."""
        assert CandidateService.truncate_summary("") == ""


# --- API Endpoint Tests: List Candidates ---


class TestListCandidatesEndpoint:
    """Tests for GET /api/v1/projects/{project_id}/candidates endpoint."""

    def test_list_candidates_returns_200(self, client: TestClient) -> None:
        """Candidate list returns 200 with pagination metadata."""
        with patch(
            "app.features.candidates.service.CandidateService.list_candidates"
        ) as mock_list:
            mock_list.return_value = PaginatedResult(
                items=[_mock_candidate(match_score=92)],
                total=1,
                page=1,
                page_size=25,
            )
            response = client.get(
                f"/api/v1/projects/{TEST_PROJECT_ID}/candidates"
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["page"] == 1
        assert data["page_size"] == 25
        assert data["total_pages"] == 1
        assert data["has_next"] is False
        assert data["has_previous"] is False
        assert len(data["items"]) == 1

    def test_list_candidates_card_fields(self, client: TestClient) -> None:
        """Each candidate card contains the expected fields."""
        with patch(
            "app.features.candidates.service.CandidateService.list_candidates"
        ) as mock_list:
            mock_list.return_value = PaginatedResult(
                items=[_mock_candidate()],
                total=1,
                page=1,
                page_size=25,
            )
            response = client.get(
                f"/api/v1/projects/{TEST_PROJECT_ID}/candidates"
            )

        data = response.json()
        card = data["items"][0]
        assert "id" in card
        assert "full_name" in card
        assert "current_company" in card
        assert "location" in card
        assert "years_experience" in card
        assert "match_score" in card
        assert "confidence_level" in card
        assert "summary" in card
        assert "processing_status" in card

    def test_list_candidates_summary_truncated(self, client: TestClient) -> None:
        """Summary is truncated to 150 characters max in list view."""
        long_summary = "x" * 300
        with patch(
            "app.features.candidates.service.CandidateService.list_candidates"
        ) as mock_list:
            mock_list.return_value = PaginatedResult(
                items=[_mock_candidate(summary=long_summary)],
                total=1,
                page=1,
                page_size=25,
            )
            response = client.get(
                f"/api/v1/projects/{TEST_PROJECT_ID}/candidates"
            )

        data = response.json()
        assert len(data["items"][0]["summary"]) == 150

    def test_list_candidates_pagination_params(self, client: TestClient) -> None:
        """Custom pagination parameters are accepted."""
        with patch(
            "app.features.candidates.service.CandidateService.list_candidates"
        ) as mock_list:
            mock_list.return_value = PaginatedResult(
                items=[], total=0, page=2, page_size=10
            )
            response = client.get(
                f"/api/v1/projects/{TEST_PROJECT_ID}/candidates?page=2&page_size=10"
            )

        assert response.status_code == 200
        mock_list.assert_called_once_with(
            project_id=TEST_PROJECT_ID,
            page=2,
            page_size=10,
            min_score=None,
            max_score=None,
            confidence=None,
        )

    def test_list_candidates_page_size_max_50(self, client: TestClient) -> None:
        """Page size above 50 is rejected by query validation."""
        response = client.get(
            f"/api/v1/projects/{TEST_PROJECT_ID}/candidates?page_size=51"
        )
        assert response.status_code == 422

    def test_list_candidates_with_score_filters(self, client: TestClient) -> None:
        """Score range filters are passed to the service."""
        with patch(
            "app.features.candidates.service.CandidateService.list_candidates"
        ) as mock_list:
            mock_list.return_value = PaginatedResult(
                items=[], total=0, page=1, page_size=25
            )
            response = client.get(
                f"/api/v1/projects/{TEST_PROJECT_ID}/candidates"
                "?min_score=60&max_score=90"
            )

        assert response.status_code == 200
        mock_list.assert_called_once_with(
            project_id=TEST_PROJECT_ID,
            page=1,
            page_size=25,
            min_score=60,
            max_score=90,
            confidence=None,
        )

    def test_list_candidates_with_confidence_filter(self, client: TestClient) -> None:
        """Confidence filter is passed to the service."""
        with patch(
            "app.features.candidates.service.CandidateService.list_candidates"
        ) as mock_list:
            mock_list.return_value = PaginatedResult(
                items=[], total=0, page=1, page_size=25
            )
            response = client.get(
                f"/api/v1/projects/{TEST_PROJECT_ID}/candidates?confidence=High"
            )

        assert response.status_code == 200
        mock_list.assert_called_once_with(
            project_id=TEST_PROJECT_ID,
            page=1,
            page_size=25,
            min_score=None,
            max_score=None,
            confidence="High",
        )

    def test_list_candidates_invalid_confidence_returns_422(
        self, client: TestClient
    ) -> None:
        """Invalid confidence level returns 422."""
        response = client.get(
            f"/api/v1/projects/{TEST_PROJECT_ID}/candidates?confidence=Invalid"
        )
        assert response.status_code == 422

    def test_list_candidates_score_out_of_range_returns_422(
        self, client: TestClient
    ) -> None:
        """Score value out of 0-100 range returns 422."""
        response = client.get(
            f"/api/v1/projects/{TEST_PROJECT_ID}/candidates?min_score=101"
        )
        assert response.status_code == 422

    def test_list_candidates_negative_score_returns_422(
        self, client: TestClient
    ) -> None:
        """Negative score value returns 422."""
        response = client.get(
            f"/api/v1/projects/{TEST_PROJECT_ID}/candidates?min_score=-1"
        )
        assert response.status_code == 422

    def test_list_candidates_invalid_project_uuid_returns_422(
        self, client: TestClient
    ) -> None:
        """Invalid UUID in project_id path returns 422."""
        response = client.get("/api/v1/projects/not-a-uuid/candidates")
        assert response.status_code == 422

    def test_list_candidates_empty_result(self, client: TestClient) -> None:
        """Empty candidate list returns 200 with empty items."""
        with patch(
            "app.features.candidates.service.CandidateService.list_candidates"
        ) as mock_list:
            mock_list.return_value = PaginatedResult(
                items=[], total=0, page=1, page_size=25
            )
            response = client.get(
                f"/api/v1/projects/{TEST_PROJECT_ID}/candidates"
            )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []
        assert data["total_pages"] == 0


# --- API Endpoint Tests: Candidate Profile ---


class TestGetCandidateProfileEndpoint:
    """Tests for GET /api/v1/candidates/{candidate_id} endpoint."""

    def test_get_candidate_returns_200(self, client: TestClient) -> None:
        """Existing candidate returns 200 with full profile."""
        candidate_id = uuid.uuid4()
        with patch(
            "app.features.candidates.service.CandidateService.get_candidate_profile"
        ) as mock_get:
            mock_get.return_value = _mock_candidate(candidate_id=candidate_id)
            response = client.get(f"/api/v1/candidates/{candidate_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(candidate_id)
        assert data["full_name"] == "Jane Smith"
        assert data["match_score"] == 85
        assert data["confidence_level"] == "High"

    def test_get_candidate_includes_all_profile_fields(
        self, client: TestClient
    ) -> None:
        """Profile response includes all expected fields."""
        candidate_id = uuid.uuid4()
        with patch(
            "app.features.candidates.service.CandidateService.get_candidate_profile"
        ) as mock_get:
            mock_get.return_value = _mock_candidate(candidate_id=candidate_id)
            response = client.get(f"/api/v1/candidates/{candidate_id}")

        data = response.json()
        # Core fields
        assert "hiring_project_id" in data
        assert "organization_id" in data
        assert "email" in data
        assert "phone" in data
        assert "linkedin_url" in data
        assert "github_url" in data
        assert "portfolio_url" in data
        assert "website_url" in data
        # AI-generated fields
        assert "parsed_data" in data
        assert "summary" in data
        assert "strengths" in data
        assert "concerns" in data
        assert "interview_questions" in data
        # Metadata
        assert "processing_status" in data
        assert "status" in data
        assert "created_at" in data
        assert "updated_at" in data

    def test_get_candidate_not_found_returns_404(self, client: TestClient) -> None:
        """Non-existent candidate returns 404."""
        candidate_id = uuid.uuid4()
        with patch(
            "app.features.candidates.service.CandidateService.get_candidate_profile"
        ) as mock_get:
            mock_get.side_effect = NotFoundException(
                message="The requested candidate was not found"
            )
            response = client.get(f"/api/v1/candidates/{candidate_id}")

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    def test_get_candidate_invalid_uuid_returns_422(self, client: TestClient) -> None:
        """Invalid UUID in path returns 422."""
        response = client.get("/api/v1/candidates/not-a-uuid")
        assert response.status_code == 422

    def test_get_candidate_full_summary_not_truncated(
        self, client: TestClient
    ) -> None:
        """Profile endpoint returns the full summary, not truncated."""
        candidate_id = uuid.uuid4()
        long_summary = "x" * 300
        with patch(
            "app.features.candidates.service.CandidateService.get_candidate_profile"
        ) as mock_get:
            mock_get.return_value = _mock_candidate(
                candidate_id=candidate_id, summary=long_summary
            )
            response = client.get(f"/api/v1/candidates/{candidate_id}")

        data = response.json()
        assert len(data["summary"]) == 300


# --- API Endpoint Tests: Hire Candidate ---


class TestHireCandidateEndpoint:
    """Tests for POST /api/v1/candidates/{candidate_id}/hire endpoint.

    Requirements: 14.1, 14.2, 14.3, 14.7
    """

    def test_hire_candidate_returns_200(self, client: TestClient) -> None:
        """Successful hire returns 200 with candidate and project_fillable flag."""
        candidate_id = uuid.uuid4()
        mock_candidate = _mock_candidate(candidate_id=candidate_id, status="hired")

        with patch(
            "app.features.candidates.service.CandidateService.hire_candidate"
        ) as mock_hire:
            from app.features.candidates.service import HireResult

            mock_hire.return_value = HireResult(
                candidate=mock_candidate, project_fillable=True
            )
            response = client.post(
                f"/api/v1/candidates/{candidate_id}/hire",
                headers={"X-CSRF-Token": CSRF_TOKEN},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["candidate"]["id"] == str(candidate_id)
        assert data["candidate"]["status"] == "hired"
        assert data["project_fillable"] is True

    def test_hire_candidate_project_not_fillable(self, client: TestClient) -> None:
        """When project cannot transition to Filled, project_fillable is False."""
        candidate_id = uuid.uuid4()
        mock_candidate = _mock_candidate(candidate_id=candidate_id, status="hired")

        with patch(
            "app.features.candidates.service.CandidateService.hire_candidate"
        ) as mock_hire:
            from app.features.candidates.service import HireResult

            mock_hire.return_value = HireResult(
                candidate=mock_candidate, project_fillable=False
            )
            response = client.post(
                f"/api/v1/candidates/{candidate_id}/hire",
                headers={"X-CSRF-Token": CSRF_TOKEN},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["project_fillable"] is False

    def test_hire_candidate_not_found_returns_404(self, client: TestClient) -> None:
        """Non-existent candidate returns 404."""
        candidate_id = uuid.uuid4()
        with patch(
            "app.features.candidates.service.CandidateService.hire_candidate"
        ) as mock_hire:
            mock_hire.side_effect = NotFoundException(
                message="The requested candidate was not found"
            )
            response = client.post(
                f"/api/v1/candidates/{candidate_id}/hire",
                headers={"X-CSRF-Token": CSRF_TOKEN},
            )

        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "NOT_FOUND"

    def test_hire_candidate_filled_project_returns_409(
        self, client: TestClient
    ) -> None:
        """Hire on a Filled project returns 409 with conflict error."""
        candidate_id = uuid.uuid4()
        with patch(
            "app.features.candidates.service.CandidateService.hire_candidate"
        ) as mock_hire:
            from app.core.security.exceptions import ConflictException

            mock_hire.side_effect = ConflictException(
                message="The project is no longer accepting candidates"
            )
            response = client.post(
                f"/api/v1/candidates/{candidate_id}/hire",
                headers={"X-CSRF-Token": CSRF_TOKEN},
            )

        assert response.status_code == 409
        data = response.json()
        assert data["error"]["code"] == "CONFLICT"
        assert "no longer accepting candidates" in data["error"]["message"]

    def test_hire_candidate_archived_project_returns_409(
        self, client: TestClient
    ) -> None:
        """Hire on an Archived project returns 409 with conflict error."""
        candidate_id = uuid.uuid4()
        with patch(
            "app.features.candidates.service.CandidateService.hire_candidate"
        ) as mock_hire:
            from app.core.security.exceptions import ConflictException

            mock_hire.side_effect = ConflictException(
                message="The project is no longer accepting candidates"
            )
            response = client.post(
                f"/api/v1/candidates/{candidate_id}/hire",
                headers={"X-CSRF-Token": CSRF_TOKEN},
            )

        assert response.status_code == 409
        data = response.json()
        assert data["error"]["code"] == "CONFLICT"
        assert "no longer accepting candidates" in data["error"]["message"]

    def test_hire_candidate_invalid_uuid_returns_422(
        self, client: TestClient
    ) -> None:
        """Invalid UUID in path returns 422."""
        response = client.post(
            "/api/v1/candidates/not-a-uuid/hire",
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        assert response.status_code == 422


# --- Service Unit Tests: Hire Candidate ---


class TestCandidateServiceHire:
    """Tests for CandidateService.hire_candidate business logic.

    Requirements: 14.1, 14.2, 14.3, 14.7
    """

    @pytest.mark.asyncio
    async def test_hire_candidate_updates_status(self) -> None:
        """hire_candidate sets candidate status to 'hired'."""
        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        mock_session.refresh = AsyncMock()

        service = CandidateService(mock_session)
        service.repository = AsyncMock()

        mock_candidate = _mock_candidate(status="active")
        mock_candidate.hiring_project_id = TEST_PROJECT_ID
        service.repository.get_by_id = AsyncMock(return_value=mock_candidate)

        # Mock the project repo
        mock_project = MagicMock()
        mock_project.state = "Active"

        with patch(
            "app.features.candidates.service.HiringProjectRepository"
        ) as MockProjectRepo:
            mock_proj_instance = AsyncMock()
            mock_proj_instance.get = AsyncMock(return_value=mock_project)
            MockProjectRepo.return_value = mock_proj_instance

            result = await service.hire_candidate(mock_candidate.id)

        assert mock_candidate.status == "hired"
        assert result.candidate == mock_candidate

    @pytest.mark.asyncio
    async def test_hire_candidate_not_found_raises(self) -> None:
        """hire_candidate raises NotFoundException for missing candidate."""
        mock_session = AsyncMock()
        service = CandidateService(mock_session)
        service.repository = AsyncMock()
        service.repository.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await service.hire_candidate(uuid.uuid4())

    @pytest.mark.asyncio
    async def test_hire_candidate_filled_project_raises_conflict(self) -> None:
        """hire_candidate raises ConflictException for Filled projects."""
        from app.core.security.exceptions import ConflictException

        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        mock_session.refresh = AsyncMock()

        service = CandidateService(mock_session)
        service.repository = AsyncMock()

        mock_candidate = _mock_candidate(status="active")
        mock_candidate.hiring_project_id = TEST_PROJECT_ID
        service.repository.get_by_id = AsyncMock(return_value=mock_candidate)

        mock_project = MagicMock()
        mock_project.state = "Filled"

        with patch(
            "app.features.candidates.service.HiringProjectRepository"
        ) as MockProjectRepo:
            mock_proj_instance = AsyncMock()
            mock_proj_instance.get = AsyncMock(return_value=mock_project)
            MockProjectRepo.return_value = mock_proj_instance

            with pytest.raises(ConflictException) as exc_info:
                await service.hire_candidate(mock_candidate.id)

        assert "no longer accepting candidates" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_hire_candidate_archived_project_raises_conflict(self) -> None:
        """hire_candidate raises ConflictException for Archived projects."""
        from app.core.security.exceptions import ConflictException

        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        mock_session.refresh = AsyncMock()

        service = CandidateService(mock_session)
        service.repository = AsyncMock()

        mock_candidate = _mock_candidate(status="active")
        mock_candidate.hiring_project_id = TEST_PROJECT_ID
        service.repository.get_by_id = AsyncMock(return_value=mock_candidate)

        mock_project = MagicMock()
        mock_project.state = "Archived"

        with patch(
            "app.features.candidates.service.HiringProjectRepository"
        ) as MockProjectRepo:
            mock_proj_instance = AsyncMock()
            mock_proj_instance.get = AsyncMock(return_value=mock_project)
            MockProjectRepo.return_value = mock_proj_instance

            with pytest.raises(ConflictException) as exc_info:
                await service.hire_candidate(mock_candidate.id)

        assert "no longer accepting candidates" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_hire_candidate_offer_extended_project_fillable(self) -> None:
        """hire_candidate returns project_fillable=True when project is in Offer Extended state."""
        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        mock_session.refresh = AsyncMock()

        service = CandidateService(mock_session)
        service.repository = AsyncMock()

        mock_candidate = _mock_candidate(status="active")
        mock_candidate.hiring_project_id = TEST_PROJECT_ID
        service.repository.get_by_id = AsyncMock(return_value=mock_candidate)

        mock_project = MagicMock()
        mock_project.state = "Offer Extended"

        with patch(
            "app.features.candidates.service.HiringProjectRepository"
        ) as MockProjectRepo:
            mock_proj_instance = AsyncMock()
            mock_proj_instance.get = AsyncMock(return_value=mock_project)
            MockProjectRepo.return_value = mock_proj_instance

            result = await service.hire_candidate(mock_candidate.id)

        assert result.project_fillable is True

    @pytest.mark.asyncio
    async def test_hire_candidate_active_project_not_fillable(self) -> None:
        """hire_candidate returns project_fillable=False when project is in Active state."""
        mock_session = AsyncMock()
        mock_session.flush = AsyncMock()
        mock_session.refresh = AsyncMock()

        service = CandidateService(mock_session)
        service.repository = AsyncMock()

        mock_candidate = _mock_candidate(status="active")
        mock_candidate.hiring_project_id = TEST_PROJECT_ID
        service.repository.get_by_id = AsyncMock(return_value=mock_candidate)

        mock_project = MagicMock()
        mock_project.state = "Active"

        with patch(
            "app.features.candidates.service.HiringProjectRepository"
        ) as MockProjectRepo:
            mock_proj_instance = AsyncMock()
            mock_proj_instance.get = AsyncMock(return_value=mock_project)
            MockProjectRepo.return_value = mock_proj_instance

            result = await service.hire_candidate(mock_candidate.id)

        assert result.project_fillable is False
