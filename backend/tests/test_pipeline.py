"""Tests for Resume Ingestion Pipeline functions.

Tests cover:
- Pipeline helper functions (normalization, year estimation, stub functions)
- EventBus integration (_publish_sse_event)
- Confidence classification in complete step
- Error handling (mark candidate failed)

Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8, 7.9, 6.4, 18.6, 18.7
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.features.ingestion.pipeline import (
    STATUS_COMPLETED,
    STATUS_FAILED,
    STATUS_PROCESSING,
    VIRUS_SCAN_CLEAN,
    _estimate_years_experience,
    _normalize_parsed_data,
    _publish_sse_event,
    _stub_generate_concerns,
    _stub_generate_questions,
    _stub_generate_strengths,
    _stub_generate_summary,
    _stub_parse_resume,
    pipeline_functions,
)


class TestPipelineFunctions:
    """Verify all 9 pipeline functions are registered."""

    def test_pipeline_has_nine_functions(self):
        """Pipeline exports exactly 9 Inngest functions (8 stages + retry)."""
        assert len(pipeline_functions) == 9

    def test_pipeline_function_ids(self):
        """Pipeline functions have correct fn_ids."""
        expected_ids = [
            "resume/virus-scan",
            "resume/extract-text",
            "resume/ai-parse",
            "resume/normalize",
            "resume/score",
            "resume/generate-summary",
            "resume/generate-questions",
            "resume/complete",
            "resume/retry",
        ]
        actual_ids = [fn._opts.local_id for fn in pipeline_functions]
        assert actual_ids == expected_ids


class TestNormalizeParsedData:
    """Tests for _normalize_parsed_data helper."""

    def test_normalizes_skills_lowercase_dedup(self):
        """Skills are deduplicated case-insensitively."""
        parsed = {
            "skills": ["Python", "python", "JavaScript", "PYTHON"],
            "contact_info": {"name": "Test"},
        }
        result = _normalize_parsed_data(parsed)
        # Should deduplicate keeping first occurrence
        assert len(result["skills"]) == 2
        assert "Python" in result["skills"]
        assert "JavaScript" in result["skills"]

    def test_normalizes_skills_strips_whitespace(self):
        """Skill strings are stripped of leading/trailing whitespace."""
        parsed = {"skills": ["  Python  ", "JavaScript  "], "contact_info": {}}
        result = _normalize_parsed_data(parsed)
        assert "Python" in result["skills"]
        assert "JavaScript" in result["skills"]

    def test_normalizes_contact_info_strips_whitespace(self):
        """Contact info strings are trimmed."""
        parsed = {
            "contact_info": {
                "name": "  John Doe  ",
                "email": " john@example.com ",
            },
            "skills": [],
        }
        result = _normalize_parsed_data(parsed)
        assert result["contact_info"]["name"] == "John Doe"
        assert result["contact_info"]["email"] == "john@example.com"

    def test_handles_empty_skills(self):
        """Empty skills list remains empty."""
        parsed = {"skills": [], "contact_info": {}}
        result = _normalize_parsed_data(parsed)
        assert result["skills"] == []

    def test_handles_dict_skills(self):
        """Skills as dicts are deduplicated by name."""
        parsed = {
            "skills": [
                {"name": "Python", "level": "expert"},
                {"name": "python", "level": "beginner"},
                {"name": "JavaScript", "level": "intermediate"},
            ],
            "contact_info": {},
        }
        result = _normalize_parsed_data(parsed)
        assert len(result["skills"]) == 2


class TestEstimateYearsExperience:
    """Tests for _estimate_years_experience helper."""

    def test_empty_experience(self):
        """Empty list returns None."""
        assert _estimate_years_experience([]) is None

    def test_with_duration_years(self):
        """Sums duration_years from positions."""
        experience = [
            {"title": "Engineer", "duration_years": 3},
            {"title": "Senior Engineer", "duration_years": 5},
        ]
        assert _estimate_years_experience(experience) == 8

    def test_fallback_to_position_count(self):
        """Without duration data, estimates 2 years per position."""
        experience = [
            {"title": "Engineer"},
            {"title": "Senior Engineer"},
            {"title": "Lead"},
        ]
        assert _estimate_years_experience(experience) == 6

    def test_mixed_duration_data(self):
        """Positions with partial duration data sum correctly."""
        experience = [
            {"title": "Engineer", "duration_years": 4},
            {"title": "Intern"},  # No duration
        ]
        # Has some duration data, so uses sum (4), not fallback
        assert _estimate_years_experience(experience) == 4


class TestStubFunctions:
    """Tests for stub functions used when AI service is unavailable."""

    def test_stub_parse_resume_returns_structure(self):
        """Stub returns expected keys for parsed resume data."""
        result = _stub_parse_resume("Some resume text")
        assert "contact_info" in result
        assert "work_experience" in result
        assert "education" in result
        assert "skills" in result
        assert "certifications" in result

    def test_stub_generate_summary_includes_score(self):
        """Stub summary mentions the match score."""
        summary = _stub_generate_summary({"contact_info": {"name": "Alice"}}, 85)
        assert "85" in summary
        assert "Alice" in summary

    def test_stub_generate_strengths_with_skills(self):
        """Stub strengths include skills when present."""
        parsed = {"skills": ["Python", "Java"], "work_experience": [], "education": []}
        strengths = _stub_generate_strengths(parsed)
        assert len(strengths) >= 1
        assert any("Technical Skills" in s.get("title", "") for s in strengths)

    def test_stub_generate_concerns_missing_contact(self):
        """Stub concerns flag missing contact info."""
        parsed = {"contact_info": {}, "work_experience": []}
        concerns = _stub_generate_concerns(parsed)
        assert any("Contact" in c.get("title", "") for c in concerns)

    def test_stub_generate_questions_returns_3_to_5(self):
        """Stub generates 3-5 interview questions."""
        questions = _stub_generate_questions({"contact_info": {}}, 80)
        assert 3 <= len(questions) <= 5

    def test_stub_generate_questions_low_score_extra(self):
        """Low match score adds an extra question about gaps."""
        questions = _stub_generate_questions({"contact_info": {}}, 60)
        assert len(questions) == 4  # 3 base + 1 for low score


class TestPublishSSEEvent:
    """Tests for _publish_sse_event integration with EventBus."""

    @pytest.mark.asyncio
    async def test_publishes_to_event_bus(self):
        """Events are published to the global EventBus."""
        mock_bus = AsyncMock()
        with patch(
            "app.core.events.event_bus.get_event_bus",
            return_value=mock_bus,
        ):
            await _publish_sse_event(
                project_id="proj-123",
                event_type="candidate.processing",
                candidate_id="cand-456",
                data={"stage": "virus_scan"},
            )
            mock_bus.publish.assert_called_once()
            call_args = mock_bus.publish.call_args
            assert call_args[0][0] == "proj-123"

    @pytest.mark.asyncio
    async def test_unknown_event_type_logs_warning(self):
        """Unknown event types are logged but not published."""
        mock_bus = AsyncMock()
        with patch(
            "app.core.events.event_bus.get_event_bus",
            return_value=mock_bus,
        ):
            await _publish_sse_event(
                project_id="proj-123",
                event_type="unknown.type",
                candidate_id="cand-456",
            )
            mock_bus.publish.assert_not_called()


class TestMarkCandidateFailed:
    """Tests for _mark_candidate_failed helper."""

    @pytest.mark.asyncio
    async def test_marks_candidate_failed_and_emits_event(self):
        """Marks candidate as processing_failed and emits SSE event."""
        with patch(
            "app.features.ingestion.pipeline._update_candidate",
            new_callable=AsyncMock,
        ) as mock_update, patch(
            "app.features.ingestion.pipeline._publish_sse_event",
            new_callable=AsyncMock,
        ) as mock_publish, patch(
            "app.core.database.session.async_session_factory",
        ) as mock_session_factory, patch(
            "app.features.ingestion.pipeline._transition_project_on_completion",
            new_callable=AsyncMock,
        ) as mock_transition:
            # Mock DB session to return pending_count > 0 (other candidates still processing)
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalar.return_value = 5  # 5 candidates still pending
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=False)
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_session_factory.return_value = mock_session

            from app.features.ingestion.pipeline import _mark_candidate_failed

            await _mark_candidate_failed("cand-123", "proj-456")

            mock_update.assert_called_once_with(
                "cand-123", processing_status=STATUS_FAILED
            )
            mock_publish.assert_called_once_with(
                project_id="proj-456",
                event_type="candidate.failed",
                candidate_id="cand-123",
            )
            # Should NOT trigger transition since there are still pending candidates
            mock_transition.assert_not_called()

    @pytest.mark.asyncio
    async def test_marks_candidate_failed_triggers_transition_when_last(self):
        """When the last candidate fails, triggers project state transition."""
        with patch(
            "app.features.ingestion.pipeline._update_candidate",
            new_callable=AsyncMock,
        ) as mock_update, patch(
            "app.features.ingestion.pipeline._publish_sse_event",
            new_callable=AsyncMock,
        ) as mock_publish, patch(
            "app.core.database.session.async_session_factory",
        ) as mock_session_factory, patch(
            "app.features.ingestion.pipeline._transition_project_on_completion",
            new_callable=AsyncMock,
        ) as mock_transition:
            # Mock DB session to return pending_count = 0 (no candidates remaining)
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalar.return_value = 0  # no candidates still pending
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=False)
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_session_factory.return_value = mock_session

            from app.features.ingestion.pipeline import _mark_candidate_failed

            await _mark_candidate_failed("cand-123", "proj-456")

            mock_update.assert_called_once_with(
                "cand-123", processing_status=STATUS_FAILED
            )
            # Should emit both candidate.failed and project.ready events
            assert mock_publish.call_count == 2
            mock_publish.assert_any_call(
                project_id="proj-456",
                event_type="candidate.failed",
                candidate_id="cand-123",
            )
            mock_publish.assert_any_call(
                project_id="proj-456",
                event_type="project.ready",
                candidate_id="cand-123",
            )
            # Should trigger transition since all candidates are done
            mock_transition.assert_called_once_with("proj-456")


class TestProcessingStatusConstants:
    """Verify processing status constants match design spec."""

    def test_status_values(self):
        """Status constants match expected string values."""
        assert STATUS_COMPLETED == "completed"
        assert STATUS_FAILED == "processing_failed"
        assert STATUS_PROCESSING == "processing"
        assert VIRUS_SCAN_CLEAN == "clean"
