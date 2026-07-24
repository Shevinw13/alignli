"""Tests for AI comparison summary generation.

Tests the ComparisonSummaryService logic including:
- Building prompt content from candidate profiles
- Parsing AI responses into structured format
- Validation of candidate count constraints
- Handling of missing/empty data gracefully

Requirements: 12.3, 12.5, 12.6
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.features.ai.comparison_summary import (
    ComparisonSummaryResponse,
    ComparisonSummaryService,
    DimensionAnalysis,
)
from app.features.ai.service import (
    AIResponseMetadata,
    AIServiceResponse,
    ConfidenceLevel,
)


def _make_candidate(
    name: str = "Test Candidate",
    match_score: int = 85,
    parsed_data: dict[str, Any] | None = None,
    strengths: list[Any] | None = None,
    concerns: list[Any] | None = None,
    summary: str | None = None,
    scores: list[Any] | None = None,
) -> MagicMock:
    """Create a mock Candidate object with configurable fields."""
    candidate = MagicMock()
    candidate.id = uuid.uuid4()
    candidate.full_name = name
    candidate.current_company = "Test Corp"
    candidate.location = "San Francisco, CA"
    candidate.years_experience = 5
    candidate.match_score = match_score
    candidate.parsed_data = parsed_data or {
        "experience": [
            {
                "title": "Senior Engineer",
                "company": "Tech Inc",
                "duration": "3 years",
                "description": "Led backend development",
            }
        ],
        "education": [
            {"degree": "BS Computer Science", "institution": "MIT"}
        ],
        "skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "certifications": [{"name": "AWS Solutions Architect"}],
    }
    candidate.strengths = strengths or ["Strong technical skills", "Leadership experience"]
    candidate.concerns = concerns or ["Limited industry experience"]
    candidate.summary = summary or "Experienced engineer with strong backend skills."
    candidate.scores = scores or []
    candidate.deleted_at = None
    candidate.organization_id = uuid.uuid4()
    return candidate


class TestComparisonSummaryServiceBuildPromptContent:
    """Tests for _build_prompt_content method."""

    def test_formats_candidate_name_and_id(self) -> None:
        """Prompt content includes candidate name and ID."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidate = _make_candidate(name="Alice Johnson")

        result = service._format_candidate_profile(candidate)

        assert "Alice Johnson" in result
        assert str(candidate.id) in result

    def test_includes_profile_fields(self) -> None:
        """Prompt content includes basic profile fields."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidate = _make_candidate()

        result = service._format_candidate_profile(candidate)

        assert "Test Corp" in result
        assert "San Francisco, CA" in result
        assert "5" in result
        assert "85/100" in result

    def test_includes_parsed_data_experience(self) -> None:
        """Prompt content includes work experience from parsed_data."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidate = _make_candidate()

        result = service._format_candidate_profile(candidate)

        assert "Senior Engineer" in result
        assert "Tech Inc" in result
        assert "3 years" in result

    def test_includes_parsed_data_education(self) -> None:
        """Prompt content includes education from parsed_data."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidate = _make_candidate()

        result = service._format_candidate_profile(candidate)

        assert "BS Computer Science" in result
        assert "MIT" in result

    def test_includes_parsed_data_skills(self) -> None:
        """Prompt content includes skills from parsed_data."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidate = _make_candidate()

        result = service._format_candidate_profile(candidate)

        assert "Python" in result
        assert "FastAPI" in result

    def test_includes_strengths_and_concerns(self) -> None:
        """Prompt content includes strengths and concerns."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidate = _make_candidate()

        result = service._format_candidate_profile(candidate)

        assert "Strong technical skills" in result
        assert "Limited industry experience" in result

    def test_handles_empty_parsed_data(self) -> None:
        """Handles candidate with no parsed_data gracefully."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidate = _make_candidate(parsed_data={})

        result = service._format_candidate_profile(candidate)

        assert "Unknown" not in result  # Name is set
        assert "Test Candidate" in result

    def test_handles_none_fields(self) -> None:
        """Handles None values for optional fields."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidate = _make_candidate()
        candidate.current_company = None
        candidate.location = None
        candidate.years_experience = None
        candidate.strengths = None
        candidate.concerns = None
        candidate.summary = None

        result = service._format_candidate_profile(candidate)

        # Should not crash and should still have the name
        assert "Test Candidate" in result

    def test_builds_multi_candidate_content(self) -> None:
        """Builds content for multiple candidates separated by dividers."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        c1 = _make_candidate(name="Alice")
        c2 = _make_candidate(name="Bob")

        result = service._build_prompt_content([c1, c2])

        assert "Alice" in result
        assert "Bob" in result
        assert "---" in result


class TestComparisonSummaryServiceParseResponse:
    """Tests for _parse_ai_response method."""

    def test_parses_successful_response(self) -> None:
        """Parses a well-structured AI response correctly."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidates = [_make_candidate(), _make_candidate()]

        ai_response = AIServiceResponse(
            content={
                "comparison_summary": "Alice ranks above Bob because of stronger technical skills.",
                "dimensions": [
                    {
                        "dimension": "technical_skills",
                        "analysis": "Alice has 5 years of Python experience at Tech Inc.",
                        "ranking": [str(candidates[0].id), str(candidates[1].id)],
                    },
                    {
                        "dimension": "experience",
                        "analysis": "Bob has more leadership roles.",
                        "ranking": [str(candidates[1].id), str(candidates[0].id)],
                    },
                ],
            },
            confidence=ConfidenceLevel.HIGH,
            metadata=AIResponseMetadata(
                input_tokens=500,
                output_tokens=300,
                latency_ms=2500,
                prompt_version="1.0.0",
            ),
        )

        result = service._parse_ai_response(ai_response, candidates)

        assert isinstance(result, ComparisonSummaryResponse)
        assert "Alice ranks above Bob" in result.summary
        assert len(result.differentiators) == 2
        assert result.differentiators[0].dimension == "technical_skills"
        assert "5 years of Python" in result.differentiators[0].analysis

    def test_handles_error_response(self) -> None:
        """Returns fallback response when AI call fails."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidates = [_make_candidate(), _make_candidate()]

        ai_response = AIServiceResponse(
            content=None,
            confidence=ConfidenceLevel.LOW,
            metadata=AIResponseMetadata(),
            error="Request timed out",
        )

        result = service._parse_ai_response(ai_response, candidates)

        assert "Unable to generate" in result.summary
        assert result.differentiators == []

    def test_handles_empty_content(self) -> None:
        """Returns fallback when content is empty dict."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidates = [_make_candidate(), _make_candidate()]

        ai_response = AIServiceResponse(
            content={},
            confidence=ConfidenceLevel.LOW,
            metadata=AIResponseMetadata(),
        )

        result = service._parse_ai_response(ai_response, candidates)

        # Empty dict is falsy, so fallback is returned
        assert "Unable to generate" in result.summary
        assert result.differentiators == []

    def test_handles_missing_dimensions(self) -> None:
        """Handles response with summary but no dimensions."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidates = [_make_candidate(), _make_candidate()]

        ai_response = AIServiceResponse(
            content={
                "comparison_summary": "Candidate A is stronger overall.",
            },
            confidence=ConfidenceLevel.MEDIUM,
            metadata=AIResponseMetadata(),
        )

        result = service._parse_ai_response(ai_response, candidates)

        assert "Candidate A is stronger" in result.summary
        assert result.differentiators == []

    def test_handles_alternate_summary_field(self) -> None:
        """Handles response using 'summary' instead of 'comparison_summary'."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidates = [_make_candidate(), _make_candidate()]

        ai_response = AIServiceResponse(
            content={
                "summary": "Fallback summary text.",
                "dimensions": [],
            },
            confidence=ConfidenceLevel.MEDIUM,
            metadata=AIResponseMetadata(),
        )

        result = service._parse_ai_response(ai_response, candidates)

        assert "Fallback summary text" in result.summary


class TestComparisonSummaryServiceValidation:
    """Tests for input validation in generate_summary."""

    @pytest.mark.asyncio
    async def test_rejects_fewer_than_2_candidates(self) -> None:
        """Rejects comparison with fewer than 2 candidates."""
        from app.core.security.exceptions import ValidationException

        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())

        with pytest.raises(ValidationException):
            await service.generate_summary(
                candidate_ids=[uuid.uuid4()],
            )

    @pytest.mark.asyncio
    async def test_rejects_more_than_4_candidates(self) -> None:
        """Rejects comparison with more than 4 candidates."""
        from app.core.security.exceptions import ValidationException

        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())

        with pytest.raises(ValidationException):
            await service.generate_summary(
                candidate_ids=[uuid.uuid4() for _ in range(5)],
            )

    @pytest.mark.asyncio
    async def test_rejects_empty_candidate_list(self) -> None:
        """Rejects comparison with empty candidate list."""
        from app.core.security.exceptions import ValidationException

        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())

        with pytest.raises(ValidationException):
            await service.generate_summary(
                candidate_ids=[],
            )


class TestComparisonSummaryServiceIntegration:
    """Integration-style tests for the full generate_summary flow."""

    @pytest.mark.asyncio
    @patch("app.features.ai.comparison_summary.get_current_org_id")
    async def test_generate_summary_full_flow(
        self, mock_get_org_id: MagicMock
    ) -> None:
        """Tests the full flow from candidate loading to response parsing."""
        org_id = uuid.uuid4()
        mock_get_org_id.return_value = str(org_id)

        # Create mock candidates
        c1 = _make_candidate(name="Alice", match_score=92)
        c2 = _make_candidate(name="Bob", match_score=78)

        candidate_ids = [c1.id, c2.id]

        # Mock the database session
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [c1, c2]
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute = AsyncMock(return_value=mock_result)

        # Mock the AI service
        mock_ai_service = AsyncMock()
        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content={
                    "comparison_summary": (
                        "Alice ranks above Bob due to her stronger Python "
                        "experience at Tech Inc (3 years as Senior Engineer) "
                        "and AWS certification."
                    ),
                    "dimensions": [
                        {
                            "dimension": "technical_skills",
                            "analysis": (
                                "Alice has demonstrated Python expertise with 3 years "
                                "at Tech Inc. Bob's skill set is more generalist."
                            ),
                            "ranking": [str(c1.id), str(c2.id)],
                        },
                    ],
                },
                confidence=ConfidenceLevel.HIGH,
                metadata=AIResponseMetadata(
                    input_tokens=800,
                    output_tokens=400,
                    latency_ms=3000,
                    prompt_version="1.0.0",
                ),
            )
        )

        service = ComparisonSummaryService(
            session=mock_session, ai_service=mock_ai_service
        )

        result = await service.generate_summary(
            candidate_ids=candidate_ids,
            organization_id=org_id,
        )

        # Verify the result references specific data points
        assert "Alice ranks above Bob" in result.summary
        assert "Tech Inc" in result.summary
        assert "Senior Engineer" in result.summary or "Python" in result.summary
        assert len(result.differentiators) == 1
        assert result.differentiators[0].dimension == "technical_skills"

        # Verify AI service was called with correct prompt type
        mock_ai_service.call.assert_called_once()
        call_kwargs = mock_ai_service.call.call_args
        assert call_kwargs.kwargs["prompt_type"].value == "analysis/candidate_comparison"

    @pytest.mark.asyncio
    @patch("app.features.ai.comparison_summary.get_current_org_id")
    async def test_not_found_when_candidate_missing(
        self, mock_get_org_id: MagicMock
    ) -> None:
        """Returns NotFoundException when candidates are not found."""
        from app.core.security.exceptions import NotFoundException

        mock_get_org_id.return_value = str(uuid.uuid4())

        # Mock session returning no candidates
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute = AsyncMock(return_value=mock_result)

        service = ComparisonSummaryService(session=mock_session, ai_service=MagicMock())

        with pytest.raises(NotFoundException):
            await service.generate_summary(
                candidate_ids=[uuid.uuid4(), uuid.uuid4()],
            )


class TestComparisonSummaryPartialData:
    """Tests for handling partial/incomplete candidate data."""

    @pytest.mark.asyncio
    @patch("app.features.ai.comparison_summary.get_current_org_id")
    async def test_generate_summary_with_partial_parsed_data(
        self, mock_get_org_id: MagicMock
    ) -> None:
        """Handles candidates with partial parsed_data (only some fields populated)."""
        org_id = uuid.uuid4()
        mock_get_org_id.return_value = str(org_id)

        # Candidate with only experience, no education/skills/certs
        c1 = _make_candidate(
            name="Partial Alice",
            match_score=80,
            parsed_data={
                "experience": [
                    {"title": "Developer", "company": "Small Co", "duration": "2 years"}
                ],
            },
            strengths=["Quick learner"],
            concerns=None,
            summary=None,
        )
        # Candidate with only skills, no experience
        c2 = _make_candidate(
            name="Partial Bob",
            match_score=75,
            parsed_data={
                "skills": ["JavaScript", "React"],
            },
            strengths=None,
            concerns=["No documented experience"],
            summary=None,
        )

        candidate_ids = [c1.id, c2.id]

        # Mock the database session
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [c1, c2]
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute = AsyncMock(return_value=mock_result)

        # Mock AI service returning a valid comparison
        mock_ai_service = AsyncMock()
        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content={
                    "comparison_summary": (
                        "Alice has practical experience at Small Co while Bob "
                        "brings frontend skills in JavaScript and React."
                    ),
                    "dimensions": [
                        {
                            "dimension": "experience",
                            "analysis": "Alice has 2 years at Small Co; Bob has no documented experience.",
                            "ranking": [str(c1.id), str(c2.id)],
                        },
                    ],
                },
                confidence=ConfidenceLevel.MEDIUM,
                metadata=AIResponseMetadata(
                    input_tokens=400, output_tokens=200, latency_ms=2000, prompt_version="1.0.0"
                ),
            )
        )

        service = ComparisonSummaryService(session=mock_session, ai_service=mock_ai_service)

        result = await service.generate_summary(
            candidate_ids=candidate_ids,
            organization_id=org_id,
        )

        assert "Alice" in result.summary or "Bob" in result.summary
        assert len(result.differentiators) == 1
        # AI was called even with partial data
        mock_ai_service.call.assert_called_once()

    def test_format_profile_with_partial_data(self) -> None:
        """Formatting a candidate with only some fields does not crash."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())
        candidate = _make_candidate(
            name="Sparse Candidate",
            parsed_data={"skills": ["Python"]},
            strengths=None,
            concerns=None,
            summary=None,
        )
        candidate.current_company = None
        candidate.location = None
        candidate.years_experience = None

        result = service._format_candidate_profile(candidate)

        assert "Sparse Candidate" in result
        assert "Python" in result
        # Should not contain "None" as a string
        assert "None" not in result

    @pytest.mark.asyncio
    @patch("app.features.ai.comparison_summary.get_current_org_id")
    async def test_ai_timeout_returns_fallback(
        self, mock_get_org_id: MagicMock
    ) -> None:
        """When AI service times out, a graceful fallback is returned."""
        org_id = uuid.uuid4()
        mock_get_org_id.return_value = str(org_id)

        c1 = _make_candidate(name="Alice", match_score=90)
        c2 = _make_candidate(name="Bob", match_score=85)
        candidate_ids = [c1.id, c2.id]

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [c1, c2]
        mock_result.scalars.return_value = mock_scalars
        mock_session.execute = AsyncMock(return_value=mock_result)

        # AI service returns an error (e.g., timeout)
        mock_ai_service = AsyncMock()
        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content=None,
                confidence=ConfidenceLevel.LOW,
                metadata=AIResponseMetadata(),
                error="Request timed out after 60s",
            )
        )

        service = ComparisonSummaryService(session=mock_session, ai_service=mock_ai_service)

        result = await service.generate_summary(
            candidate_ids=candidate_ids,
            organization_id=org_id,
        )

        # Should return a graceful fallback, not raise
        assert "Unable to generate" in result.summary
        assert result.differentiators == []


class TestFormatParsedData:
    """Tests for _format_parsed_data helper."""

    def test_formats_string_experience(self) -> None:
        """Handles experience as a plain string."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())

        result = service._format_parsed_data({"experience": "10 years in software"})

        assert "10 years in software" in result

    def test_formats_list_skills(self) -> None:
        """Handles skills as a list."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())

        result = service._format_parsed_data({"skills": ["Python", "Go", "Rust"]})

        assert "Python" in result
        assert "Go" in result
        assert "Rust" in result

    def test_handles_work_experience_alt_key(self) -> None:
        """Handles 'work_experience' as alternate key for experience."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())

        result = service._format_parsed_data({
            "work_experience": [{"title": "CTO", "company": "Startup Co"}]
        })

        assert "CTO" in result
        assert "Startup Co" in result

    def test_handles_empty_parsed_data(self) -> None:
        """Returns fallback string for empty parsed data."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())

        result = service._format_parsed_data({})

        assert "No structured data available" in result

    def test_includes_certifications(self) -> None:
        """Formats certifications correctly."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())

        result = service._format_parsed_data({
            "certifications": [{"name": "PMP"}, "AWS SAA"]
        })

        assert "PMP" in result
        assert "AWS SAA" in result

    def test_includes_projects(self) -> None:
        """Formats projects correctly."""
        service = ComparisonSummaryService(session=MagicMock(), ai_service=MagicMock())

        result = service._format_parsed_data({
            "projects": [{"name": "E-commerce Platform"}, "Open Source CLI"]
        })

        assert "E-commerce Platform" in result
        assert "Open Source CLI" in result
