"""Tests for job description extraction AI function.

Tests the JD extraction endpoint and business logic, including:
- Parsing AI responses into structured categories
- Validation of request inputs
- Handling of AI service errors
- Endpoint integration tests

Requirements: 4.1, 4.2, 4.3, 4.4
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.features.ai.jd_extraction import (
    extract_job_description,
    parse_extraction_response,
)
from app.features.ai.schemas import (
    CertificationItem,
    EducationItem,
    ExtractedCategories,
    JDExtractionResponse,
    LocationRequirements,
    SkillItem,
    YearsExperience,
)
from app.features.ai.service import (
    AIResponseMetadata,
    AIServiceResponse,
    ConfidenceLevel,
)
from app.main import app


# --- Unit tests for parse_extraction_response ---


class TestParseExtractionResponse:
    """Tests for parsing AI response into structured extraction data."""

    def test_parses_complete_response(self):
        """A complete AI response should be parsed into all categories."""
        ai_response = AIServiceResponse(
            content={
                "required_skills": [
                    {"name": "Python", "description": "3+ years experience"},
                    {"name": "FastAPI", "description": "REST API development"},
                ],
                "preferred_skills": [
                    {"name": "Docker", "description": "Container orchestration"},
                ],
                "education": [
                    {
                        "level": "Bachelor's",
                        "field": "Computer Science",
                        "description": "BS in CS or equivalent",
                    }
                ],
                "years_experience": {
                    "minimum": 3,
                    "preferred": 5,
                    "description": "3-5 years of software engineering",
                },
                "certifications": [
                    {"name": "AWS Solutions Architect", "required_or_preferred": "preferred"}
                ],
                "location_requirements": {
                    "location": "San Francisco, CA",
                    "remote_policy": "Hybrid",
                    "travel_requirements": "10% travel",
                },
                "keywords": ["Python", "FastAPI", "microservices", "AWS", "REST"],
            },
            confidence=ConfidenceLevel.HIGH,
            metadata=AIResponseMetadata(
                input_tokens=500,
                output_tokens=300,
                latency_ms=1200,
                prompt_version="1.0.0",
            ),
        )

        result = parse_extraction_response(ai_response)

        assert isinstance(result, JDExtractionResponse)
        assert result.confidence == "High"
        assert len(result.categories.required_skills) == 2
        assert result.categories.required_skills[0].name == "Python"
        assert result.categories.required_skills[1].name == "FastAPI"
        assert len(result.categories.preferred_skills) == 1
        assert result.categories.preferred_skills[0].name == "Docker"
        assert len(result.categories.education) == 1
        assert result.categories.education[0].level == "Bachelor's"
        assert result.categories.years_experience is not None
        assert result.categories.years_experience.minimum == 3
        assert result.categories.years_experience.preferred == 5
        assert len(result.categories.certifications) == 1
        assert result.categories.certifications[0].name == "AWS Solutions Architect"
        assert result.categories.location_requirements is not None
        assert result.categories.location_requirements.location == "San Francisco, CA"
        assert len(result.categories.keywords) == 5

    def test_parses_empty_response(self):
        """An empty AI response should return empty categories."""
        ai_response = AIServiceResponse(
            content={},
            confidence=ConfidenceLevel.LOW,
            metadata=AIResponseMetadata(),
        )

        result = parse_extraction_response(ai_response)

        assert result.confidence == "Low"
        assert result.categories.required_skills == []
        assert result.categories.preferred_skills == []
        assert result.categories.education == []
        assert result.categories.years_experience is None
        assert result.categories.certifications == []
        assert result.categories.location_requirements is None
        assert result.categories.keywords == []

    def test_parses_null_content(self):
        """A None content should return empty categories."""
        ai_response = AIServiceResponse(
            content=None,
            confidence=ConfidenceLevel.LOW,
            metadata=AIResponseMetadata(),
        )

        result = parse_extraction_response(ai_response)

        assert result.categories.required_skills == []
        assert result.categories.keywords == []

    def test_parses_partial_response(self):
        """Partial AI response (only some categories) should parse correctly."""
        ai_response = AIServiceResponse(
            content={
                "required_skills": [{"name": "JavaScript", "description": None}],
                "keywords": ["React", "Node.js"],
            },
            confidence=ConfidenceLevel.MEDIUM,
            metadata=AIResponseMetadata(),
        )

        result = parse_extraction_response(ai_response)

        assert result.confidence == "Medium"
        assert len(result.categories.required_skills) == 1
        assert result.categories.required_skills[0].name == "JavaScript"
        assert result.categories.preferred_skills == []
        assert result.categories.keywords == ["React", "Node.js"]

    def test_parses_skills_as_strings(self):
        """Skills provided as plain strings should be parsed into SkillItems."""
        ai_response = AIServiceResponse(
            content={
                "required_skills": ["Python", "Java", "SQL"],
                "preferred_skills": ["Kubernetes"],
            },
            confidence=ConfidenceLevel.MEDIUM,
            metadata=AIResponseMetadata(),
        )

        result = parse_extraction_response(ai_response)

        assert len(result.categories.required_skills) == 3
        assert result.categories.required_skills[0].name == "Python"
        assert result.categories.required_skills[0].description is None

    def test_parses_certifications_as_strings(self):
        """Certifications provided as plain strings should be parsed."""
        ai_response = AIServiceResponse(
            content={
                "certifications": ["AWS SAA", "CKA"],
            },
            confidence=ConfidenceLevel.MEDIUM,
            metadata=AIResponseMetadata(),
        )

        result = parse_extraction_response(ai_response)

        assert len(result.categories.certifications) == 2
        assert result.categories.certifications[0].name == "AWS SAA"

    def test_filters_empty_keywords(self):
        """Empty/null keyword values should be filtered out."""
        ai_response = AIServiceResponse(
            content={
                "keywords": ["Python", "", None, "FastAPI"],
            },
            confidence=ConfidenceLevel.MEDIUM,
            metadata=AIResponseMetadata(),
        )

        result = parse_extraction_response(ai_response)

        assert result.categories.keywords == ["Python", "FastAPI"]


# --- Unit tests for extract_job_description ---


class TestExtractJobDescription:
    """Tests for the extract_job_description business logic function."""

    @pytest.mark.asyncio
    async def test_successful_extraction(self):
        """Successful AI call should return parsed JD extraction."""
        mock_ai_service = AsyncMock()
        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content={
                    "required_skills": [{"name": "Python", "description": "Backend dev"}],
                    "keywords": ["Python", "API"],
                },
                confidence=ConfidenceLevel.HIGH,
                metadata=AIResponseMetadata(
                    input_tokens=100,
                    output_tokens=50,
                    latency_ms=800,
                    prompt_version="1.0.0",
                ),
            )
        )

        result = await extract_job_description(
            text="We are looking for a Python developer with 5+ years of experience in building REST APIs.",
            ai_service=mock_ai_service,
        )

        assert isinstance(result, JDExtractionResponse)
        assert result.confidence == "High"
        assert len(result.categories.required_skills) == 1
        assert result.categories.required_skills[0].name == "Python"

    @pytest.mark.asyncio
    async def test_raises_on_ai_error(self):
        """Should raise ValueError when AI service returns an error."""
        mock_ai_service = AsyncMock()
        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content=None,
                confidence=ConfidenceLevel.LOW,
                metadata=AIResponseMetadata(),
                error="Request timed out after 60s",
            )
        )

        with pytest.raises(ValueError, match="AI extraction failed"):
            await extract_job_description(
                text="Some job description text that is long enough to pass validation checks.",
                ai_service=mock_ai_service,
            )

    @pytest.mark.asyncio
    async def test_passes_correct_prompt_type(self):
        """Should call AIService with PromptType.JOB_DESCRIPTION."""
        mock_ai_service = AsyncMock()
        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content={"required_skills": [], "keywords": []},
                confidence=ConfidenceLevel.LOW,
                metadata=AIResponseMetadata(),
            )
        )

        from app.features.ai.service import PromptType

        await extract_job_description(
            text="A job description for a senior software engineer role at a tech company.",
            ai_service=mock_ai_service,
        )

        mock_ai_service.call.assert_called_once()
        call_kwargs = mock_ai_service.call.call_args
        assert call_kwargs.kwargs.get("prompt_type") is None or True
        # Check positional args
        args = call_kwargs.args if call_kwargs.args else []
        kwargs = call_kwargs.kwargs if call_kwargs.kwargs else {}

        # The call should use PromptType.JOB_DESCRIPTION
        if args:
            assert args[0] == PromptType.JOB_DESCRIPTION
        else:
            assert kwargs.get("prompt_type") == PromptType.JOB_DESCRIPTION

    @pytest.mark.asyncio
    async def test_passes_org_and_project_context(self):
        """Should forward organization_id and hiring_project_id to AIService."""
        mock_ai_service = AsyncMock()
        mock_ai_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content={"required_skills": []},
                confidence=ConfidenceLevel.MEDIUM,
                metadata=AIResponseMetadata(),
            )
        )

        org_id = uuid.uuid4()
        project_id = uuid.uuid4()

        await extract_job_description(
            text="A job description for testing that includes enough characters to pass validation.",
            ai_service=mock_ai_service,
            organization_id=org_id,
            hiring_project_id=project_id,
        )

        call_kwargs = mock_ai_service.call.call_args.kwargs
        assert call_kwargs["organization_id"] == org_id
        assert call_kwargs["hiring_project_id"] == project_id


# --- Endpoint integration tests ---

CSRF_TOKEN = "test-csrf-token-for-jd-extraction"


class TestExtractJDEndpoint:
    """Integration tests for the POST /projects/{project_id}/extract-jd endpoint."""

    @pytest.fixture
    def project_id(self) -> str:
        return str(uuid.uuid4())

    @pytest.fixture
    def mock_auth(self):
        """Mock authentication and dependencies to bypass external services."""
        from app.core.middleware.auth import AuthenticatedUser, get_current_user
        from app.core.database.session import get_db
        from app.features.ai.router import get_ai_service

        mock_user = AuthenticatedUser(
            user_id="user_123",
            org_id=str(uuid.uuid4()),
            role="Hiring_Manager",
        )
        # Mock the db session dependency to avoid real DB connections
        mock_db = AsyncMock()
        # Mock the AI service to avoid real API calls
        mock_ai = AsyncMock()
        mock_ai.call = AsyncMock(
            return_value=AIServiceResponse(
                content={},
                confidence=ConfidenceLevel.LOW,
                metadata=AIResponseMetadata(),
            )
        )
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_ai_service] = lambda: mock_ai
        yield mock_user
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_ai_service, None)

    @pytest.fixture
    def client(self, mock_auth) -> TestClient:
        test_client = TestClient(app)
        test_client.cookies.set("csrf_token", CSRF_TOKEN)
        return test_client

    def _post(self, client, url, json_body):
        """Helper to POST with CSRF headers."""
        return client.post(
            url,
            json=json_body,
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )

    def test_rejects_empty_request(self, client, project_id):
        """Should return 400 when neither text nor file_url is provided."""
        response = self._post(
            client,
            f"/api/v1/projects/{project_id}/extract-jd",
            {"text": None, "file_url": None},
        )
        assert response.status_code == 400

    def test_rejects_short_text(self, client, project_id):
        """Should return 400 when text is too short (< 50 chars)."""
        response = self._post(
            client,
            f"/api/v1/projects/{project_id}/extract-jd",
            {"text": "Too short"},
        )
        assert response.status_code == 400
        body = response.json()
        assert "too short" in str(body).lower() or "50 characters" in str(body).lower()

    def test_rejects_file_url_only(self, client, project_id):
        """Should return 400 when only file_url is provided (not yet supported)."""
        response = self._post(
            client,
            f"/api/v1/projects/{project_id}/extract-jd",
            {"text": None, "file_url": "https://storage.example.com/file.pdf"},
        )
        assert response.status_code == 400

    def test_successful_extraction(self, client, project_id):
        """Should return 200 with extracted categories on successful AI call."""
        from app.features.ai.router import get_ai_service

        mock_service = AsyncMock()
        mock_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content={
                    "required_skills": [
                        {"name": "Python", "description": "3+ years"},
                    ],
                    "preferred_skills": [
                        {"name": "Docker", "description": "Nice to have"},
                    ],
                    "education": [
                        {"level": "Bachelor's", "field": "CS", "description": "Required"},
                    ],
                    "years_experience": {
                        "minimum": 3,
                        "preferred": 5,
                        "description": "3-5 years",
                    },
                    "certifications": [],
                    "location_requirements": {
                        "location": "Remote",
                        "remote_policy": "Fully remote",
                        "travel_requirements": None,
                    },
                    "keywords": ["Python", "microservices"],
                },
                confidence=ConfidenceLevel.HIGH,
                metadata=AIResponseMetadata(
                    input_tokens=200,
                    output_tokens=150,
                    latency_ms=900,
                    prompt_version="1.0.0",
                ),
            )
        )
        app.dependency_overrides[get_ai_service] = lambda: mock_service

        try:
            jd_text = (
                "We are looking for a Senior Python Developer with 3-5 years of experience "
                "in building microservices. Docker experience is preferred."
            )

            response = self._post(
                client,
                f"/api/v1/projects/{project_id}/extract-jd",
                {"text": jd_text},
            )

            assert response.status_code == 200
            body = response.json()
            assert "categories" in body
            assert "confidence" in body
            assert body["confidence"] == "High"
            categories = body["categories"]
            assert len(categories["required_skills"]) == 1
            assert categories["required_skills"][0]["name"] == "Python"
            assert len(categories["preferred_skills"]) == 1
            assert len(categories["keywords"]) == 2
        finally:
            app.dependency_overrides.pop(get_ai_service, None)

    def test_returns_502_on_ai_failure(self, client, project_id):
        """Should return 502 when AI service returns an error."""
        from app.features.ai.router import get_ai_service

        mock_service = AsyncMock()
        mock_service.call = AsyncMock(
            return_value=AIServiceResponse(
                content=None,
                confidence=ConfidenceLevel.LOW,
                metadata=AIResponseMetadata(),
                error="Connection timeout",
            )
        )
        app.dependency_overrides[get_ai_service] = lambda: mock_service

        try:
            jd_text = (
                "Senior Software Engineer role requiring expertise in cloud architecture "
                "and distributed systems design patterns."
            )

            response = self._post(
                client,
                f"/api/v1/projects/{project_id}/extract-jd",
                {"text": jd_text},
            )

            assert response.status_code == 502
            body = response.json()
            assert "AI_EXTRACTION_FAILED" in str(body) or "extraction failed" in str(body).lower()
        finally:
            app.dependency_overrides.pop(get_ai_service, None)
