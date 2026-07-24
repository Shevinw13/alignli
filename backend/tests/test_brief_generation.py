"""Tests for AI Brief generation.

Tests cover:
- Zero candidates case returns minimal response without AI call
- Score distribution computation (excellent/strong/review)
- Top candidates extraction (sorted, limited to 3)
- AI call integration (success and failure cases)
- Endpoint integration tests

Requirements: 9.2, 9.3, 9.4, 9.5
"""

from __future__ import annotations

import uuid
from typing import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.database.session import set_current_org_id
from app.core.middleware.auth import AuthenticatedUser
from app.features.ai.brief_generation import (
    BriefResponse,
    ScoreDistribution,
    TopCandidate,
    _compute_score_distribution,
    _get_top_candidates,
    generate_brief,
)
from app.features.ai.service import (
    AIResponseMetadata,
    AIService,
    AIServiceResponse,
    ConfidenceLevel,
)
from app.main import app

# --- Constants ---

TEST_ORG_ID = str(uuid.uuid4())
TEST_USER_ID = "user_test_brief_123"
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
    full_name: str = "Jane Smith",
    match_score: int | None = 85,
    current_company: str | None = "Acme Corp",
    location: str | None = "San Francisco",
    years_experience: int | None = 5,
    confidence_level: str | None = "High",
) -> MagicMock:
    """Create a mock candidate object."""
    candidate = MagicMock()
    candidate.full_name = full_name
    candidate.match_score = match_score
    candidate.current_company = current_company
    candidate.location = location
    candidate.years_experience = years_experience
    candidate.confidence_level = confidence_level
    return candidate


# --- Fixtures ---


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a test client with mocked auth and db dependencies."""
    from app.core.database.session import get_db
    from app.core.middleware.auth import get_current_user
    from app.features.ai.router import _get_ai_service

    async def mock_get_db():
        yield AsyncMock()

    mock_ai = AsyncMock(spec=AIService)
    mock_ai.call = AsyncMock(
        return_value=AIServiceResponse(
            content=None,
            confidence=ConfidenceLevel.LOW,
            metadata=AIResponseMetadata(),
            error="Not configured in test",
        )
    )

    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    app.dependency_overrides[get_db] = mock_get_db
    app.dependency_overrides[_get_ai_service] = lambda: mock_ai
    set_current_org_id(TEST_ORG_ID)

    test_client = TestClient(app)
    test_client.cookies.set("csrf_token", CSRF_TOKEN)

    yield test_client

    app.dependency_overrides.clear()
    set_current_org_id(None)


# --- Unit Tests: Score Distribution ---


class TestScoreDistribution:
    """Tests for _compute_score_distribution helper."""

    def test_empty_candidates(self) -> None:
        """Empty list returns all zeros."""
        result = _compute_score_distribution([])
        assert result.excellent == 0
        assert result.strong == 0
        assert result.review == 0

    def test_excellent_score(self) -> None:
        """Scores 95-100 are counted as excellent."""
        candidates = [
            _mock_candidate(match_score=95),
            _mock_candidate(match_score=100),
            _mock_candidate(match_score=97),
        ]
        result = _compute_score_distribution(candidates)
        assert result.excellent == 3
        assert result.strong == 0
        assert result.review == 0

    def test_strong_score(self) -> None:
        """Scores 80-94 are counted as strong."""
        candidates = [
            _mock_candidate(match_score=80),
            _mock_candidate(match_score=94),
            _mock_candidate(match_score=87),
        ]
        result = _compute_score_distribution(candidates)
        assert result.excellent == 0
        assert result.strong == 3
        assert result.review == 0

    def test_review_score(self) -> None:
        """Scores 0-79 are counted as review."""
        candidates = [
            _mock_candidate(match_score=0),
            _mock_candidate(match_score=79),
            _mock_candidate(match_score=50),
        ]
        result = _compute_score_distribution(candidates)
        assert result.excellent == 0
        assert result.strong == 0
        assert result.review == 3

    def test_none_score_counted_as_review(self) -> None:
        """Candidates with None score are counted as review."""
        candidates = [_mock_candidate(match_score=None)]
        result = _compute_score_distribution(candidates)
        assert result.review == 1

    def test_mixed_scores(self) -> None:
        """Mixed scores are distributed correctly."""
        candidates = [
            _mock_candidate(match_score=96),
            _mock_candidate(match_score=85),
            _mock_candidate(match_score=82),
            _mock_candidate(match_score=70),
            _mock_candidate(match_score=None),
        ]
        result = _compute_score_distribution(candidates)
        assert result.excellent == 1
        assert result.strong == 2
        assert result.review == 2


# --- Unit Tests: Top Candidates ---


class TestGetTopCandidates:
    """Tests for _get_top_candidates helper."""

    def test_empty_candidates(self) -> None:
        """Empty list returns empty list."""
        result = _get_top_candidates([])
        assert result == []

    def test_returns_top_3_by_score(self) -> None:
        """Returns top 3 candidates sorted by match_score descending."""
        candidates = [
            _mock_candidate(full_name="Alice", match_score=90),
            _mock_candidate(full_name="Bob", match_score=95),
            _mock_candidate(full_name="Carol", match_score=80),
            _mock_candidate(full_name="Dave", match_score=88),
        ]
        result = _get_top_candidates(candidates, limit=3)
        assert len(result) == 3
        assert result[0].name == "Bob"
        assert result[0].score == 95
        assert result[1].name == "Alice"
        assert result[1].score == 90
        assert result[2].name == "Dave"
        assert result[2].score == 88

    def test_excludes_none_scores(self) -> None:
        """Candidates with None scores are excluded."""
        candidates = [
            _mock_candidate(full_name="Alice", match_score=90),
            _mock_candidate(full_name="Bob", match_score=None),
            _mock_candidate(full_name="Carol", match_score=80),
        ]
        result = _get_top_candidates(candidates, limit=3)
        assert len(result) == 2
        assert result[0].name == "Alice"
        assert result[1].name == "Carol"

    def test_fewer_than_limit(self) -> None:
        """Returns all candidates when fewer than limit."""
        candidates = [
            _mock_candidate(full_name="Alice", match_score=90),
            _mock_candidate(full_name="Bob", match_score=85),
        ]
        result = _get_top_candidates(candidates, limit=3)
        assert len(result) == 2

    def test_unknown_name_for_none_full_name(self) -> None:
        """Candidates with None full_name get 'Unknown'."""
        candidates = [_mock_candidate(full_name=None, match_score=90)]
        result = _get_top_candidates(candidates, limit=3)
        assert result[0].name == "Unknown"


# --- Unit Tests: generate_brief ---


class TestGenerateBrief:
    """Tests for generate_brief business logic."""

    @pytest.mark.asyncio
    async def test_zero_candidates_returns_minimal_response(self) -> None:
        """Zero candidates returns total_candidates=0 and static summary without AI call."""
        mock_session = AsyncMock()
        mock_ai_service = AsyncMock(spec=AIService)

        with patch(
            "app.features.ai.brief_generation.CandidateRepository"
        ) as MockRepo:
            from app.core.database.repository import PaginatedResult

            mock_repo_instance = AsyncMock()
            mock_repo_instance.list_by_project = AsyncMock(
                return_value=PaginatedResult(items=[], total=0, page=1, page_size=1000)
            )
            MockRepo.return_value = mock_repo_instance

            result = await generate_brief(
                project_id=TEST_PROJECT_ID,
                session=mock_session,
                ai_service=mock_ai_service,
            )

        assert result.total_candidates == 0
        assert result.summary == "No candidates have been added yet."
        assert result.score_distribution is None
        assert result.top_candidates is None
        assert result.patterns is None
        assert result.recommended_action is None
        # AI service should NOT be called
        mock_ai_service.call.assert_not_called()

    @pytest.mark.asyncio
    async def test_with_candidates_calls_ai_service(self) -> None:
        """With candidates, calls AI service and returns full brief."""
        mock_session = AsyncMock()
        mock_ai_service = AsyncMock(spec=AIService)

        candidates = [
            _mock_candidate(full_name="Alice", match_score=96),
            _mock_candidate(full_name="Bob", match_score=85),
            _mock_candidate(full_name="Carol", match_score=70),
        ]

        ai_content = {
            "total_candidates": 3,
            "score_distribution": "1 excellent, 1 strong, 1 review",
            "top_candidates": [
                {"name": "Alice", "score": 96, "key_qualifier": "Expert in ML"}
            ],
            "patterns": [
                "Most applicants lack Kubernetes experience",
                "Strong ML background is common",
            ],
            "recommended_action": "Interview Alice first",
            "summary": "We analyzed 3 resumes. 1 candidate scored excellent.",
        }

        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content=ai_content,
                confidence=ConfidenceLevel.HIGH,
                metadata=AIResponseMetadata(
                    input_tokens=500,
                    output_tokens=200,
                    latency_ms=1500,
                    prompt_version="1.0.0",
                ),
            )
        )

        with patch(
            "app.features.ai.brief_generation.CandidateRepository"
        ) as MockRepo:
            from app.core.database.repository import PaginatedResult

            mock_repo_instance = AsyncMock()
            mock_repo_instance.list_by_project = AsyncMock(
                return_value=PaginatedResult(
                    items=candidates, total=3, page=1, page_size=1000
                )
            )
            MockRepo.return_value = mock_repo_instance

            result = await generate_brief(
                project_id=TEST_PROJECT_ID,
                session=mock_session,
                ai_service=mock_ai_service,
                organization_id=uuid.UUID(TEST_ORG_ID),
            )

        assert result.total_candidates == 3
        assert result.score_distribution is not None
        assert result.score_distribution.excellent == 1
        assert result.score_distribution.strong == 1
        assert result.score_distribution.review == 1
        assert result.top_candidates is not None
        assert len(result.top_candidates) == 3
        assert result.top_candidates[0].name == "Alice"
        assert result.top_candidates[0].score == 96
        assert result.patterns == [
            "Most applicants lack Kubernetes experience",
            "Strong ML background is common",
        ]
        assert result.recommended_action == "Interview Alice first"
        assert result.summary == "We analyzed 3 resumes. 1 candidate scored excellent."
        mock_ai_service.call.assert_called_once()

    @pytest.mark.asyncio
    async def test_ai_failure_returns_stats_without_ai_content(self) -> None:
        """When AI call fails, returns stats but no AI-generated content."""
        mock_session = AsyncMock()
        mock_ai_service = AsyncMock(spec=AIService)

        candidates = [
            _mock_candidate(full_name="Alice", match_score=90),
            _mock_candidate(full_name="Bob", match_score=80),
        ]

        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content=None,
                confidence=ConfidenceLevel.LOW,
                metadata=AIResponseMetadata(),
                error="Request timed out",
            )
        )

        with patch(
            "app.features.ai.brief_generation.CandidateRepository"
        ) as MockRepo:
            from app.core.database.repository import PaginatedResult

            mock_repo_instance = AsyncMock()
            mock_repo_instance.list_by_project = AsyncMock(
                return_value=PaginatedResult(
                    items=candidates, total=2, page=1, page_size=1000
                )
            )
            MockRepo.return_value = mock_repo_instance

            result = await generate_brief(
                project_id=TEST_PROJECT_ID,
                session=mock_session,
                ai_service=mock_ai_service,
            )

        assert result.total_candidates == 2
        assert result.score_distribution is not None
        assert result.top_candidates is not None
        assert result.patterns is None
        assert result.recommended_action is None
        assert "could not generate a full brief" in result.summary

    @pytest.mark.asyncio
    async def test_patterns_limited_to_3(self) -> None:
        """Patterns from AI response are limited to 3 maximum."""
        mock_session = AsyncMock()
        mock_ai_service = AsyncMock(spec=AIService)

        candidates = [_mock_candidate(full_name="Alice", match_score=90)]

        ai_content = {
            "patterns": [
                "Pattern 1",
                "Pattern 2",
                "Pattern 3",
                "Pattern 4",
                "Pattern 5",
            ],
            "recommended_action": "Do something",
            "summary": "Brief summary.",
        }

        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content=ai_content,
                confidence=ConfidenceLevel.HIGH,
                metadata=AIResponseMetadata(
                    input_tokens=100, output_tokens=50, latency_ms=500, prompt_version="1.0.0"
                ),
            )
        )

        with patch(
            "app.features.ai.brief_generation.CandidateRepository"
        ) as MockRepo:
            from app.core.database.repository import PaginatedResult

            mock_repo_instance = AsyncMock()
            mock_repo_instance.list_by_project = AsyncMock(
                return_value=PaginatedResult(
                    items=candidates, total=1, page=1, page_size=1000
                )
            )
            MockRepo.return_value = mock_repo_instance

            result = await generate_brief(
                project_id=TEST_PROJECT_ID,
                session=mock_session,
                ai_service=mock_ai_service,
            )

        assert result.patterns is not None
        assert len(result.patterns) == 3

    @pytest.mark.asyncio
    async def test_generates_default_summary_when_ai_omits(self) -> None:
        """When AI response doesn't include 'summary', a default is generated."""
        mock_session = AsyncMock()
        mock_ai_service = AsyncMock(spec=AIService)

        candidates = [
            _mock_candidate(full_name="Alice", match_score=96),
            _mock_candidate(full_name="Bob", match_score=85),
        ]

        ai_content = {
            "patterns": ["Some pattern"],
            "recommended_action": "Take action",
            # no 'summary' key
        }

        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content=ai_content,
                confidence=ConfidenceLevel.MEDIUM,
                metadata=AIResponseMetadata(
                    input_tokens=100, output_tokens=50, latency_ms=500, prompt_version="1.0.0"
                ),
            )
        )

        with patch(
            "app.features.ai.brief_generation.CandidateRepository"
        ) as MockRepo:
            from app.core.database.repository import PaginatedResult

            mock_repo_instance = AsyncMock()
            mock_repo_instance.list_by_project = AsyncMock(
                return_value=PaginatedResult(
                    items=candidates, total=2, page=1, page_size=1000
                )
            )
            MockRepo.return_value = mock_repo_instance

            result = await generate_brief(
                project_id=TEST_PROJECT_ID,
                session=mock_session,
                ai_service=mock_ai_service,
            )

        assert "We analyzed 2 resumes" in result.summary
        assert "1 candidates scored excellent" in result.summary or "1 scored excellent" in result.summary


# --- API Endpoint Tests ---


class TestBriefEndpoint:
    """Tests for GET /api/v1/projects/{project_id}/brief endpoint."""

    def test_brief_zero_candidates_returns_200(self, client: TestClient) -> None:
        """Zero candidates returns 200 with minimal brief."""
        with patch(
            "app.features.ai.brief_generation.CandidateRepository"
        ) as MockRepo:
            from app.core.database.repository import PaginatedResult

            mock_repo_instance = AsyncMock()
            mock_repo_instance.list_by_project = AsyncMock(
                return_value=PaginatedResult(items=[], total=0, page=1, page_size=1000)
            )
            MockRepo.return_value = mock_repo_instance

            response = client.get(f"/api/v1/projects/{TEST_PROJECT_ID}/brief")

        assert response.status_code == 200
        data = response.json()
        assert data["total_candidates"] == 0
        assert data["summary"] == "No candidates have been added yet."
        assert data["score_distribution"] is None
        assert data["top_candidates"] is None
        assert data["patterns"] is None
        assert data["recommended_action"] is None

    def test_brief_with_candidates_returns_200(self, client: TestClient) -> None:
        """With candidates, returns 200 with full brief."""
        from app.features.ai.router import _get_ai_service

        candidates = [
            _mock_candidate(full_name="Alice", match_score=96),
            _mock_candidate(full_name="Bob", match_score=85),
            _mock_candidate(full_name="Carol", match_score=70),
        ]

        ai_content = {
            "patterns": ["Pattern 1"],
            "recommended_action": "Interview top candidates",
            "summary": "We analyzed 3 resumes.",
        }

        mock_ai_service = AsyncMock(spec=AIService)
        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content=ai_content,
                confidence=ConfidenceLevel.HIGH,
                metadata=AIResponseMetadata(
                    input_tokens=500,
                    output_tokens=200,
                    latency_ms=1500,
                    prompt_version="1.0.0",
                ),
            )
        )

        # Override dependency for this specific test
        app.dependency_overrides[_get_ai_service] = lambda: mock_ai_service

        with patch(
            "app.features.ai.brief_generation.CandidateRepository"
        ) as MockRepo:
            from app.core.database.repository import PaginatedResult

            mock_repo_instance = AsyncMock()
            mock_repo_instance.list_by_project = AsyncMock(
                return_value=PaginatedResult(
                    items=candidates, total=3, page=1, page_size=1000
                )
            )
            MockRepo.return_value = mock_repo_instance

            response = client.get(f"/api/v1/projects/{TEST_PROJECT_ID}/brief")

        assert response.status_code == 200
        data = response.json()
        assert data["total_candidates"] == 3
        assert data["score_distribution"]["excellent"] == 1
        assert data["score_distribution"]["strong"] == 1
        assert data["score_distribution"]["review"] == 1
        assert len(data["top_candidates"]) == 3
        assert data["top_candidates"][0]["name"] == "Alice"
        assert data["top_candidates"][0]["score"] == 96
        assert data["patterns"] == ["Pattern 1"]
        assert data["recommended_action"] == "Interview top candidates"
        assert data["summary"] == "We analyzed 3 resumes."

    def test_brief_invalid_project_uuid_returns_422(self, client: TestClient) -> None:
        """Invalid UUID in project_id path returns 422."""
        response = client.get("/api/v1/projects/not-a-uuid/brief")
        assert response.status_code == 422
