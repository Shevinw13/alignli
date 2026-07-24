"""Tests for the candidate comparison endpoint.

Tests validation logic (2-4 candidate count constraint) and response schema.

Requirements: 12.1, 12.4
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.middleware.auth import AuthenticatedUser, get_current_user
from app.features.comparison.schemas import (
    CompareRequest,
    CompareResponse,
    ComparedCandidateResponse,
    ComparisonDimensions,
    CriterionScoreResponse,
)
from app.features.comparison.service import ComparisonService
from app.main import app


# Fake authenticated user for dependency override
_fake_user = AuthenticatedUser(
    user_id="test-user-123",
    org_id="test-org-456",
    role="Hiring_Manager",
)


def _override_get_current_user() -> AuthenticatedUser:
    return _fake_user


class TestCompareRequestValidation:
    """Test the CompareRequest schema validation."""

    def test_valid_two_candidates(self):
        """Should accept exactly 2 candidates."""
        ids = [uuid.uuid4(), uuid.uuid4()]
        req = CompareRequest(candidate_ids=ids)
        assert len(req.candidate_ids) == 2

    def test_valid_three_candidates(self):
        """Should accept exactly 3 candidates."""
        ids = [uuid.uuid4(), uuid.uuid4(), uuid.uuid4()]
        req = CompareRequest(candidate_ids=ids)
        assert len(req.candidate_ids) == 3

    def test_valid_four_candidates(self):
        """Should accept exactly 4 candidates."""
        ids = [uuid.uuid4() for _ in range(4)]
        req = CompareRequest(candidate_ids=ids)
        assert len(req.candidate_ids) == 4

    def test_reject_one_candidate(self):
        """Should reject fewer than 2 candidates."""
        with pytest.raises(Exception):
            CompareRequest(candidate_ids=[uuid.uuid4()])

    def test_reject_zero_candidates(self):
        """Should reject an empty list."""
        with pytest.raises(Exception):
            CompareRequest(candidate_ids=[])

    def test_reject_five_candidates(self):
        """Should reject more than 4 candidates."""
        ids = [uuid.uuid4() for _ in range(5)]
        with pytest.raises(Exception):
            CompareRequest(candidate_ids=ids)


class TestCompareEndpointValidation:
    """Test the POST /api/v1/candidates/compare endpoint validation."""

    CSRF_TOKEN = "test-csrf-token"

    def setup_method(self):
        """Set up test client with auth override."""
        app.dependency_overrides[get_current_user] = _override_get_current_user
        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up dependency overrides."""
        app.dependency_overrides.clear()

    def _post_compare(self, json_body: dict) -> "Response":
        """Helper to POST to compare endpoint with CSRF token."""
        return self.client.post(
            "/api/v1/candidates/compare",
            json=json_body,
            headers={"x-csrf-token": self.CSRF_TOKEN},
            cookies={"csrf_token": self.CSRF_TOKEN},
        )

    def test_reject_fewer_than_two_candidates(self):
        """Should return 422 when fewer than 2 candidates provided."""
        response = self._post_compare(
            {"candidate_ids": [str(uuid.uuid4())]}
        )
        assert response.status_code == 422

    def test_reject_more_than_four_candidates(self):
        """Should return 422 when more than 4 candidates provided."""
        ids = [str(uuid.uuid4()) for _ in range(5)]
        response = self._post_compare({"candidate_ids": ids})
        assert response.status_code == 422

    def test_reject_empty_list(self):
        """Should return 422 when no candidates provided."""
        response = self._post_compare({"candidate_ids": []})
        assert response.status_code == 422

    def test_reject_invalid_uuids(self):
        """Should return 422 for invalid UUID format."""
        response = self._post_compare(
            {"candidate_ids": ["not-a-uuid", "also-not"]}
        )
        assert response.status_code == 422


class TestComparisonDimensions:
    """Test the dimension extraction logic."""

    def test_extract_experience_from_list(self):
        """Should summarize experience from parsed data list format."""
        service = ComparisonService(session=AsyncMock())
        parsed = {
            "experience": [
                {"title": "Senior Engineer", "company": "Acme Corp"},
                {"title": "Engineer", "company": "Startup Inc"},
            ]
        }
        result = service._summarize_experience(parsed)
        assert "Senior Engineer at Acme Corp" in result
        assert "Engineer at Startup Inc" in result

    def test_extract_experience_from_string(self):
        """Should return experience directly if it's a string."""
        service = ComparisonService(session=AsyncMock())
        parsed = {"experience": "10 years in software engineering"}
        result = service._summarize_experience(parsed)
        assert result == "10 years in software engineering"

    def test_extract_experience_missing(self):
        """Should return None when no experience data."""
        service = ComparisonService(session=AsyncMock())
        result = service._summarize_experience({})
        assert result is None

    def test_extract_skills_from_list(self):
        """Should join skills into a comma-separated string."""
        service = ComparisonService(session=AsyncMock())
        parsed = {"skills": ["Python", "FastAPI", "PostgreSQL"]}
        result = service._summarize_skills(parsed)
        assert result == "Python, FastAPI, PostgreSQL"

    def test_extract_skills_missing(self):
        """Should return None when no skills data."""
        service = ComparisonService(session=AsyncMock())
        result = service._summarize_skills({})
        assert result is None

    def test_extract_education_from_list(self):
        """Should summarize education entries."""
        service = ComparisonService(session=AsyncMock())
        parsed = {
            "education": [
                {"degree": "MSc Computer Science", "institution": "MIT"},
            ]
        }
        result = service._summarize_education(parsed)
        assert "MSc Computer Science" in result
        assert "MIT" in result

    def test_extract_education_missing(self):
        """Should return None when no education data."""
        service = ComparisonService(session=AsyncMock())
        result = service._summarize_education({})
        assert result is None

    def test_extract_generic_dimension_string(self):
        """Should return string dimension directly."""
        service = ComparisonService(session=AsyncMock())
        parsed = {"leadership": "Led team of 8 engineers"}
        result = service._extract_dimension(parsed, "leadership")
        assert result == "Led team of 8 engineers"

    def test_extract_generic_dimension_missing(self):
        """Should return None for missing dimension."""
        service = ComparisonService(session=AsyncMock())
        result = service._extract_dimension({}, "leadership")
        assert result is None


class TestCompareResponseSchema:
    """Test the response schema structure."""

    def test_response_structure(self):
        """Should produce valid response with all fields."""
        response = CompareResponse(
            candidates=[
                ComparedCandidateResponse(
                    id=uuid.uuid4(),
                    full_name="John Doe",
                    match_score=92,
                    criterion_scores=[
                        CriterionScoreResponse(
                            criterion_id=uuid.uuid4(),
                            raw_score=80,
                            normalized_score=80.0,
                            reasoning="Strong Python experience",
                        )
                    ],
                    comparison_dimensions=ComparisonDimensions(
                        experience="Senior Engineer at Acme",
                        technical_skills="Python, FastAPI",
                        leadership=None,
                        education="MSc CS, MIT",
                    ),
                ),
                ComparedCandidateResponse(
                    id=uuid.uuid4(),
                    full_name="Jane Smith",
                    match_score=85,
                    criterion_scores=[],
                    comparison_dimensions=ComparisonDimensions(),
                ),
            ]
        )
        assert len(response.candidates) == 2
        assert response.candidates[0].match_score == 92
        assert response.candidates[0].comparison_dimensions.experience == "Senior Engineer at Acme"
        assert response.candidates[1].comparison_dimensions.leadership is None
