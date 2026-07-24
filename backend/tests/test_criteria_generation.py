"""Tests for ranking criteria AI generation.

Tests cover:
- parse_criteria_response correctly parses valid AI responses
- parse_criteria_response handles various response formats (code blocks, nested)
- Invalid/missing criteria fields are normalized or rejected
- CriteriaGenerationError is raised for error responses
- generate_ranking_criteria calls AIService with correct prompt type
- End-to-end flow with mocked AIService

Requirements: 5.1, 5.2
"""

from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.features.ai.criteria_generation import (
    VALID_CATEGORIES,
    CriteriaGenerationError,
    CriteriaGenerationResult,
    RankingCriterionResult,
    _normalize_criterion,
    generate_ranking_criteria,
    parse_criteria_response,
)
from app.features.ai.service import (
    AIResponseMetadata,
    AIServiceResponse,
    ConfidenceLevel,
)


# --- Test _normalize_criterion ---


class TestNormalizeCriterion:
    """Tests for the _normalize_criterion helper function."""

    def test_valid_criterion(self):
        """Valid criterion is returned unchanged."""
        raw = {
            "category": "Skill Match",
            "label": "Python expertise",
            "priority": "High",
            "max_score": 100,
        }
        result = _normalize_criterion(raw)
        assert result == raw

    def test_priority_case_normalization(self):
        """Priority is capitalized correctly."""
        raw = {
            "category": "Experience",
            "label": "5+ years backend",
            "priority": "high",
            "max_score": 80,
        }
        result = _normalize_criterion(raw)
        assert result["priority"] == "High"

    def test_invalid_priority_defaults_to_medium(self):
        """Invalid priority defaults to Medium."""
        raw = {
            "category": "Education",
            "label": "CS Degree",
            "priority": "Critical",
            "max_score": 70,
        }
        result = _normalize_criterion(raw)
        assert result["priority"] == "Medium"

    def test_max_score_clamped_to_range(self):
        """max_score is clamped to [1, 100]."""
        raw_high = {
            "category": "Skill Match",
            "label": "Test",
            "priority": "Low",
            "max_score": 150,
        }
        result = _normalize_criterion(raw_high)
        assert result["max_score"] == 100

        raw_low = {
            "category": "Skill Match",
            "label": "Test",
            "priority": "Low",
            "max_score": 0,
        }
        result = _normalize_criterion(raw_low)
        assert result["max_score"] == 1

    def test_max_score_float_converted_to_int(self):
        """Float max_score is converted to int."""
        raw = {
            "category": "Skill Match",
            "label": "Test",
            "priority": "Low",
            "max_score": 85.7,
        }
        result = _normalize_criterion(raw)
        assert result["max_score"] == 85
        assert isinstance(result["max_score"], int)

    def test_missing_max_score_defaults_to_100(self):
        """Missing max_score defaults to 100."""
        raw = {
            "category": "Skill Match",
            "label": "Test",
            "priority": "High",
        }
        result = _normalize_criterion(raw)
        assert result["max_score"] == 100

    def test_invalid_category_defaults_to_custom(self):
        """Invalid category defaults to Custom."""
        raw = {
            "category": "Some Unknown Category",
            "label": "Test",
            "priority": "Medium",
            "max_score": 50,
        }
        result = _normalize_criterion(raw)
        assert result["category"] == "Custom"

    def test_category_case_insensitive_match(self):
        """Category matching is case-insensitive."""
        raw = {
            "category": "skill match",
            "label": "Python",
            "priority": "High",
            "max_score": 100,
        }
        result = _normalize_criterion(raw)
        assert result["category"] == "Skill Match"

    def test_empty_label_returns_none(self):
        """Empty label causes the criterion to be rejected."""
        raw = {
            "category": "Skill Match",
            "label": "",
            "priority": "High",
            "max_score": 100,
        }
        result = _normalize_criterion(raw)
        assert result is None

    def test_missing_label_returns_none(self):
        """Missing label causes the criterion to be rejected."""
        raw = {
            "category": "Skill Match",
            "priority": "High",
            "max_score": 100,
        }
        result = _normalize_criterion(raw)
        assert result is None


# --- Test parse_criteria_response ---


class TestParseCriteriaResponse:
    """Tests for parse_criteria_response function."""

    def test_parse_valid_response(self):
        """Correctly parses a well-formed AI response."""
        ai_response = AIServiceResponse(
            content={
                "criteria": [
                    {
                        "category": "Skill Match",
                        "label": "Python expertise",
                        "priority": "High",
                        "max_score": 100,
                    },
                    {
                        "category": "Experience",
                        "label": "5+ years backend development",
                        "priority": "High",
                        "max_score": 90,
                    },
                    {
                        "category": "Education",
                        "label": "Computer Science degree",
                        "priority": "Medium",
                        "max_score": 70,
                    },
                ]
            },
            confidence=ConfidenceLevel.HIGH,
            metadata=AIResponseMetadata(
                input_tokens=500,
                output_tokens=300,
                latency_ms=2000,
                prompt_version="1.0.0",
            ),
            error=None,
        )

        result = parse_criteria_response(ai_response)

        assert isinstance(result, CriteriaGenerationResult)
        assert len(result.criteria) == 3
        assert result.criteria[0].category == "Skill Match"
        assert result.criteria[0].label == "Python expertise"
        assert result.criteria[0].priority == "High"
        assert result.criteria[0].max_score == 100
        assert result.criteria[1].category == "Experience"
        assert result.criteria[2].category == "Education"

    def test_parse_response_with_error(self):
        """Raises CriteriaGenerationError when AI returns an error."""
        ai_response = AIServiceResponse(
            content=None,
            confidence=ConfidenceLevel.LOW,
            error="Request timed out after 60s",
        )

        with pytest.raises(CriteriaGenerationError) as exc_info:
            parse_criteria_response(ai_response)

        assert "AI service returned an error" in exc_info.value.message
        assert exc_info.value.ai_error == "Request timed out after 60s"

    def test_parse_response_with_empty_content(self):
        """Raises CriteriaGenerationError when content is None."""
        ai_response = AIServiceResponse(
            content=None,
            confidence=ConfidenceLevel.LOW,
            error=None,
        )

        with pytest.raises(CriteriaGenerationError) as exc_info:
            parse_criteria_response(ai_response)

        assert "empty content" in exc_info.value.message

    def test_parse_response_with_raw_response_key(self):
        """Handles response wrapped in raw_response key."""
        criteria_json = json.dumps(
            {
                "criteria": [
                    {
                        "category": "Certifications",
                        "label": "AWS Certified",
                        "priority": "Medium",
                        "max_score": 60,
                    }
                ]
            }
        )
        ai_response = AIServiceResponse(
            content={"raw_response": criteria_json},
            confidence=ConfidenceLevel.LOW,
            metadata=AIResponseMetadata(),
            error=None,
        )

        result = parse_criteria_response(ai_response)
        assert len(result.criteria) == 1
        assert result.criteria[0].category == "Certifications"

    def test_parse_response_no_criteria_key(self):
        """Raises error when response has no criteria list."""
        ai_response = AIServiceResponse(
            content={"something_else": "data"},
            confidence=ConfidenceLevel.MEDIUM,
            error=None,
        )

        with pytest.raises(CriteriaGenerationError) as exc_info:
            parse_criteria_response(ai_response)

        assert "did not contain criteria" in exc_info.value.message

    def test_parse_response_skips_invalid_criteria(self):
        """Valid criteria are returned even when some are invalid."""
        ai_response = AIServiceResponse(
            content={
                "criteria": [
                    {
                        "category": "Skill Match",
                        "label": "Python",
                        "priority": "High",
                        "max_score": 100,
                    },
                    {
                        "category": "Experience",
                        "label": "",  # Invalid: empty label
                        "priority": "Medium",
                        "max_score": 50,
                    },
                    "not a dict",  # Invalid: not a dict
                    {
                        "category": "Education",
                        "label": "Master's degree",
                        "priority": "Low",
                        "max_score": 40,
                    },
                ]
            },
            confidence=ConfidenceLevel.MEDIUM,
            error=None,
        )

        result = parse_criteria_response(ai_response)
        assert len(result.criteria) == 2
        assert result.criteria[0].label == "Python"
        assert result.criteria[1].label == "Master's degree"

    def test_parse_response_all_invalid_criteria_raises_error(self):
        """Raises error when all criteria are invalid."""
        ai_response = AIServiceResponse(
            content={
                "criteria": [
                    {"category": "Skill Match", "label": "", "priority": "High", "max_score": 100},
                    {"category": "Experience", "priority": "Low", "max_score": 50},
                ]
            },
            confidence=ConfidenceLevel.LOW,
            error=None,
        )

        with pytest.raises(CriteriaGenerationError) as exc_info:
            parse_criteria_response(ai_response)

        assert "No valid criteria" in exc_info.value.message

    def test_parse_response_with_list_in_raw_response(self):
        """Handles raw_response containing a bare list of criteria."""
        criteria_json = json.dumps(
            [
                {
                    "category": "Leadership",
                    "label": "Team management",
                    "priority": "Medium",
                    "max_score": 75,
                }
            ]
        )
        ai_response = AIServiceResponse(
            content={"raw_response": criteria_json},
            confidence=ConfidenceLevel.MEDIUM,
            error=None,
        )

        result = parse_criteria_response(ai_response)
        assert len(result.criteria) == 1
        assert result.criteria[0].category == "Leadership"


# --- Test generate_ranking_criteria ---


class TestGenerateRankingCriteria:
    """Tests for the generate_ranking_criteria function."""

    @pytest.mark.asyncio
    async def test_calls_ai_service_with_correct_prompt_type(self):
        """Verifies AIService is called with PromptType.RANKING_CRITERIA."""
        mock_ai_service = MagicMock()
        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content={
                    "criteria": [
                        {
                            "category": "Skill Match",
                            "label": "Python",
                            "priority": "High",
                            "max_score": 100,
                        }
                    ]
                },
                confidence=ConfidenceLevel.HIGH,
                metadata=AIResponseMetadata(
                    input_tokens=200,
                    output_tokens=150,
                    latency_ms=3000,
                    prompt_version="1.0.0",
                ),
                error=None,
            )
        )

        extracted_jd = {
            "required_skills": [{"name": "Python", "description": "3+ years"}],
            "preferred_skills": [{"name": "Django"}],
            "education": [{"level": "Bachelor's", "field": "CS"}],
        }

        result = await generate_ranking_criteria(
            extracted_jd=extracted_jd,
            ai_service=mock_ai_service,
        )

        # Verify the AI service was called
        mock_ai_service.call.assert_called_once()
        call_kwargs = mock_ai_service.call.call_args

        # Verify prompt type
        from app.features.ai.service import PromptType

        assert call_kwargs[1]["prompt_type"] == PromptType.RANKING_CRITERIA
        # Verify the extracted JD was passed as JSON in user_content
        user_content = call_kwargs[1]["user_content"]
        parsed = json.loads(user_content)
        assert "required_skills" in parsed
        assert "preferred_skills" in parsed

        # Verify result
        assert len(result.criteria) == 1
        assert result.criteria[0].label == "Python"

    @pytest.mark.asyncio
    async def test_passes_organization_and_project_context(self):
        """Verifies org_id and project_id are passed to AIService."""
        mock_ai_service = MagicMock()
        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content={
                    "criteria": [
                        {
                            "category": "Experience",
                            "label": "Backend dev",
                            "priority": "High",
                            "max_score": 90,
                        }
                    ]
                },
                confidence=ConfidenceLevel.HIGH,
                error=None,
            )
        )

        org_id = uuid.uuid4()
        project_id = uuid.uuid4()
        mock_db = AsyncMock()

        await generate_ranking_criteria(
            extracted_jd={"required_skills": []},
            ai_service=mock_ai_service,
            db=mock_db,
            organization_id=org_id,
            hiring_project_id=project_id,
        )

        call_kwargs = mock_ai_service.call.call_args[1]
        assert call_kwargs["db"] is mock_db
        assert call_kwargs["organization_id"] == org_id
        assert call_kwargs["hiring_project_id"] == project_id

    @pytest.mark.asyncio
    async def test_raises_error_on_ai_failure(self):
        """Raises CriteriaGenerationError when AI returns an error."""
        mock_ai_service = MagicMock()
        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content=None,
                confidence=ConfidenceLevel.LOW,
                error="API timeout",
            )
        )

        with pytest.raises(CriteriaGenerationError) as exc_info:
            await generate_ranking_criteria(
                extracted_jd={"required_skills": []},
                ai_service=mock_ai_service,
            )

        assert "AI service returned an error" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_generates_multiple_criteria(self):
        """Verifies multiple criteria can be generated from a rich JD."""
        mock_ai_service = MagicMock()
        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content={
                    "criteria": [
                        {
                            "category": "Skill Match",
                            "label": "Python expertise",
                            "priority": "High",
                            "max_score": 100,
                        },
                        {
                            "category": "Skill Match",
                            "label": "AWS experience",
                            "priority": "Medium",
                            "max_score": 80,
                        },
                        {
                            "category": "Experience",
                            "label": "5+ years backend",
                            "priority": "High",
                            "max_score": 90,
                        },
                        {
                            "category": "Education",
                            "label": "CS degree",
                            "priority": "Low",
                            "max_score": 50,
                        },
                        {
                            "category": "Certifications",
                            "label": "AWS Solutions Architect",
                            "priority": "Medium",
                            "max_score": 60,
                        },
                    ]
                },
                confidence=ConfidenceLevel.HIGH,
                error=None,
            )
        )

        extracted_jd = {
            "required_skills": [
                {"name": "Python", "description": "5+ years"},
                {"name": "AWS", "description": "Production experience"},
            ],
            "preferred_skills": [{"name": "Kubernetes"}],
            "education": [{"level": "Bachelor's", "field": "Computer Science"}],
            "certifications": [
                {"name": "AWS Solutions Architect", "required_or_preferred": "preferred"}
            ],
            "years_experience": {"minimum": 5, "preferred": 7},
        }

        result = await generate_ranking_criteria(
            extracted_jd=extracted_jd,
            ai_service=mock_ai_service,
        )

        assert len(result.criteria) == 5
        categories = [c.category for c in result.criteria]
        assert "Skill Match" in categories
        assert "Experience" in categories
        assert "Education" in categories
        assert "Certifications" in categories

        # Verify all criteria have valid fields
        for criterion in result.criteria:
            assert criterion.category in VALID_CATEGORIES
            assert criterion.priority in ("Low", "Medium", "High")
            assert 1 <= criterion.max_score <= 100
            assert len(criterion.label) > 0


# --- Test RankingCriterionResult validation ---


class TestRankingCriterionResult:
    """Tests for the RankingCriterionResult Pydantic model."""

    def test_valid_criterion(self):
        """Valid criterion passes validation."""
        criterion = RankingCriterionResult(
            category="Skill Match",
            label="Python expertise",
            priority="High",
            max_score=100,
        )
        assert criterion.category == "Skill Match"
        assert criterion.priority == "High"
        assert criterion.max_score == 100

    def test_invalid_priority_raises_error(self):
        """Invalid priority raises validation error."""
        with pytest.raises(Exception):  # Pydantic ValidationError
            RankingCriterionResult(
                category="Skill Match",
                label="Test",
                priority="Critical",
                max_score=100,
            )

    def test_invalid_category_raises_error(self):
        """Invalid category raises validation error."""
        with pytest.raises(Exception):  # Pydantic ValidationError
            RankingCriterionResult(
                category="Unknown Category",
                label="Test",
                priority="High",
                max_score=100,
            )

    def test_max_score_below_minimum(self):
        """max_score below 1 raises validation error."""
        with pytest.raises(Exception):
            RankingCriterionResult(
                category="Skill Match",
                label="Test",
                priority="High",
                max_score=0,
            )

    def test_max_score_above_maximum(self):
        """max_score above 100 raises validation error."""
        with pytest.raises(Exception):
            RankingCriterionResult(
                category="Skill Match",
                label="Test",
                priority="High",
                max_score=101,
            )

    def test_all_valid_categories(self):
        """All defined categories are accepted."""
        for category in VALID_CATEGORIES:
            criterion = RankingCriterionResult(
                category=category,
                label=f"Test for {category}",
                priority="Medium",
                max_score=50,
            )
            assert criterion.category == category

    def test_all_valid_priorities(self):
        """All valid priorities are accepted."""
        for priority in ("Low", "Medium", "High"):
            criterion = RankingCriterionResult(
                category="Skill Match",
                label=f"Test {priority}",
                priority=priority,
                max_score=75,
            )
            assert criterion.priority == priority
