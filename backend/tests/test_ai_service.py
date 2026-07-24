"""Tests for the AI service module."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.features.ai.service import (
    AIService,
    AIServiceResponse,
    ConfidenceLevel,
    PromptType,
    _parse_json_response,
    load_bias_guard,
    load_prompt,
    PROMPTS_DIR,
)


class TestLoadPrompt:
    """Tests for prompt loading functionality."""

    def test_load_resume_to_json_prompt(self):
        """Verify the resume_to_json prompt loads correctly with version."""
        content, version = load_prompt(PromptType.RESUME_TO_JSON)
        assert "resume parsing assistant" in content.lower()
        assert version == "1.0.0"

    def test_load_job_description_prompt(self):
        """Verify the job_description prompt loads correctly."""
        content, version = load_prompt(PromptType.JOB_DESCRIPTION)
        assert "job description" in content.lower()
        assert version == "1.0.0"

    def test_load_candidate_summary_prompt(self):
        """Verify the candidate_summary prompt loads correctly."""
        content, version = load_prompt(PromptType.CANDIDATE_SUMMARY)
        assert "150 to 250 words" in content
        assert version == "1.0.0"

    def test_load_candidate_comparison_prompt(self):
        """Verify the candidate_comparison prompt loads correctly."""
        content, version = load_prompt(PromptType.CANDIDATE_COMPARISON)
        assert "evidence-based comparison" in content.lower()
        assert version == "1.0.0"

    def test_load_interview_questions_prompt(self):
        """Verify the interview_questions prompt loads correctly."""
        content, version = load_prompt(PromptType.INTERVIEW_QUESTIONS)
        assert "interview questions" in content.lower()
        assert version == "1.0.0"

    def test_load_ai_brief_prompt(self):
        """Verify the ai_brief prompt loads correctly."""
        content, version = load_prompt(PromptType.AI_BRIEF)
        assert "AI Brief" in content
        assert version == "1.0.0"

    def test_load_ranking_criteria_prompt(self):
        """Verify the ranking_criteria prompt loads correctly."""
        content, version = load_prompt(PromptType.RANKING_CRITERIA)
        assert "ranking criteria" in content.lower()
        assert version == "1.0.0"

    def test_all_prompt_files_exist(self):
        """Verify all prompt types have corresponding files."""
        for prompt_type in PromptType:
            prompt_path = PROMPTS_DIR / f"{prompt_type.value}.txt"
            assert prompt_path.exists(), f"Missing prompt file: {prompt_path}"


class TestLoadBiasGuard:
    """Tests for bias guard prompt loading."""

    def test_load_bias_guard(self):
        """Verify bias guard prompt loads and contains key rules."""
        content = load_bias_guard()
        assert "NEVER infer protected characteristics" in content
        assert "age" in content.lower()
        assert "race" in content.lower()
        assert "gender" in content.lower()
        assert "religion" in content.lower()
        assert "disability" in content.lower()
        assert "national origin" in content.lower()

    def test_bias_guard_prevents_fabrication(self):
        """Verify bias guard includes rules against inventing information."""
        content = load_bias_guard()
        assert "NEVER invent" in content
        assert "certifications" in content.lower()
        assert "employers" in content.lower()

    def test_bias_guard_requires_explicit_data_only(self):
        """Verify bias guard requires referencing only explicit data."""
        content = load_bias_guard()
        assert "ONLY reference information explicitly" in content


class TestParseJsonResponse:
    """Tests for JSON response parsing."""

    def test_parse_plain_json(self):
        """Parse plain JSON string."""
        result = _parse_json_response('{"key": "value"}')
        assert result == {"key": "value"}

    def test_parse_json_with_code_block(self):
        """Parse JSON wrapped in markdown code block."""
        text = '```json\n{"key": "value"}\n```'
        result = _parse_json_response(text)
        assert result == {"key": "value"}

    def test_parse_json_with_plain_code_block(self):
        """Parse JSON wrapped in plain code block (no language tag)."""
        text = '```\n{"key": "value"}\n```'
        result = _parse_json_response(text)
        assert result == {"key": "value"}

    def test_parse_invalid_json(self):
        """Return None for invalid JSON."""
        result = _parse_json_response("not json at all")
        assert result is None

    def test_parse_empty_string(self):
        """Return None for empty string."""
        result = _parse_json_response("")
        assert result is None

    def test_parse_complex_json(self):
        """Parse complex nested JSON."""
        data = {
            "questions": [
                {"question": "Tell me about X", "rationale": "reason", "category": "technical"}
            ],
            "count": 1,
        }
        result = _parse_json_response(json.dumps(data))
        assert result == data


class TestConfidenceDetermination:
    """Tests for confidence level determination."""

    def test_high_confidence_from_explicit_field(self):
        """Use explicit confidence field from response."""
        service = AIService.__new__(AIService)
        content = {"data": "value", "confidence": "High"}
        result = service._determine_confidence(content)
        assert result == ConfidenceLevel.HIGH

    def test_medium_confidence_from_explicit_field(self):
        """Use explicit confidence field from response."""
        service = AIService.__new__(AIService)
        content = {"data": "value", "confidence": "Medium"}
        result = service._determine_confidence(content)
        assert result == ConfidenceLevel.MEDIUM

    def test_low_confidence_from_explicit_field(self):
        """Use explicit confidence field from response."""
        service = AIService.__new__(AIService)
        content = {"data": "value", "confidence": "Low"}
        result = service._determine_confidence(content)
        assert result == ConfidenceLevel.LOW

    def test_high_confidence_from_completeness(self):
        """High confidence when most fields are populated."""
        service = AIService.__new__(AIService)
        content = {"a": "1", "b": "2", "c": "3", "d": "4", "e": "5"}
        result = service._determine_confidence(content)
        assert result == ConfidenceLevel.HIGH

    def test_medium_confidence_from_completeness(self):
        """Medium confidence when some fields are empty."""
        service = AIService.__new__(AIService)
        content = {"a": "1", "b": "2", "c": "3", "d": None, "e": None}
        result = service._determine_confidence(content)
        assert result == ConfidenceLevel.MEDIUM

    def test_low_confidence_from_completeness(self):
        """Low confidence when most fields are empty."""
        service = AIService.__new__(AIService)
        content = {"a": "1", "b": None, "c": None, "d": None, "e": None}
        result = service._determine_confidence(content)
        assert result == ConfidenceLevel.LOW

    def test_low_confidence_empty_dict(self):
        """Low confidence for empty dict."""
        service = AIService.__new__(AIService)
        content = {}
        result = service._determine_confidence(content)
        assert result == ConfidenceLevel.LOW


class TestAIServiceResponse:
    """Tests for the AIServiceResponse model."""

    def test_successful_response(self):
        """Verify a successful response structure."""
        from app.features.ai.service import AIResponseMetadata

        response = AIServiceResponse(
            content={"summary": "Test summary"},
            confidence=ConfidenceLevel.HIGH,
            metadata=AIResponseMetadata(
                input_tokens=100,
                output_tokens=200,
                latency_ms=1500,
                prompt_version="1.0.0",
            ),
            error=None,
        )
        assert response.content == {"summary": "Test summary"}
        assert response.confidence == ConfidenceLevel.HIGH
        assert response.metadata.input_tokens == 100
        assert response.metadata.output_tokens == 200
        assert response.metadata.latency_ms == 1500
        assert response.metadata.prompt_version == "1.0.0"
        assert response.error is None

    def test_error_response(self):
        """Verify an error response structure."""
        response = AIServiceResponse(
            content=None,
            confidence=ConfidenceLevel.LOW,
            error="Request timed out",
        )
        assert response.content is None
        assert response.confidence == ConfidenceLevel.LOW
        assert response.error == "Request timed out"


class TestPromptTypeEnum:
    """Tests for the PromptType enum."""

    def test_all_prompt_types_defined(self):
        """Verify expected prompt types exist."""
        expected = {
            "RESUME_TO_JSON",
            "JOB_DESCRIPTION",
            "CANDIDATE_SUMMARY",
            "CANDIDATE_COMPARISON",
            "INTERVIEW_QUESTIONS",
            "AI_BRIEF",
            "RANKING_CRITERIA",
        }
        actual = {pt.name for pt in PromptType}
        assert actual == expected

    def test_prompt_type_values_are_paths(self):
        """Verify prompt type values map to directory/file paths."""
        for pt in PromptType:
            parts = pt.value.split("/")
            assert len(parts) == 2, f"PromptType {pt.name} should be category/filename"


class TestPromptContentRules:
    """Tests verifying prompt content follows safety and formatting rules."""

    def test_all_prompts_include_json_return_format(self):
        """All prompts (except bias guard) specify JSON return format."""
        for prompt_type in PromptType:
            content, _ = load_prompt(prompt_type)
            # extraction/resume_to_json uses "Return ONLY valid JSON"
            # Others use "Return your response as JSON"
            assert "json" in content.lower(), (
                f"Prompt {prompt_type.value} should specify JSON return format"
            )

    def test_all_prompts_have_version(self):
        """All prompts include a version string."""
        for prompt_type in PromptType:
            _, version = load_prompt(prompt_type)
            assert version != "unknown", f"Prompt {prompt_type.value} missing version"

    def test_bias_guard_has_version(self):
        """Bias guard prompt includes version."""
        content = load_bias_guard()
        assert "Version:" in content
