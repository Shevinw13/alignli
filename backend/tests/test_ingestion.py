"""Tests for Resume Ingestion upload validation and signed URL generation.

Tests cover:
- File validation: PDF-only (MIME type + extension), max 10 MB, max 50 files per batch
- Partial success: valid files processed, invalid files rejected with reasons
- Per-file status in response (accepted with upload_url/candidate_id, rejected with reason)
- Signed URL generation via Supabase Storage

Requirements: 6.1, 6.2, 6.3, 6.5, 6.7, 6.8
"""

from __future__ import annotations

import uuid
from typing import Generator
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.database.session import set_current_org_id
from app.core.middleware.auth import AuthenticatedUser
from app.features.ingestion.schemas import (
    FileAcceptedResult,
    FileMetadata,
    FileRejectedResult,
    ResumeUploadRequest,
    ResumeUploadResponse,
)
from app.features.ingestion.service import (
    ALLOWED_EXTENSION,
    ALLOWED_MIME_TYPE,
    MAX_BATCH_SIZE,
    MAX_FILE_SIZE_BYTES,
    IngestionService,
    _validate_file,
)
from app.main import app

# --- Constants ---

TEST_ORG_ID = str(uuid.uuid4())
TEST_USER_ID = "user_test_ingestion_123"
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


def _valid_pdf_file(filename: str = "resume.pdf", size: int = 524288) -> dict:
    """Create a valid PDF file metadata dict."""
    return {
        "filename": filename,
        "size_bytes": size,
        "mime_type": "application/pdf",
    }


def _invalid_docx_file() -> dict:
    """Create an invalid DOCX file metadata dict."""
    return {
        "filename": "resume.docx",
        "size_bytes": 1048576,
        "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }


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


# --- Unit Tests: _validate_file ---


class TestValidateFile:
    """Tests for the _validate_file helper function."""

    def test_valid_pdf_returns_none(self) -> None:
        """Valid PDF file returns no error."""
        file = FileMetadata(filename="resume.pdf", size_bytes=524288, mime_type="application/pdf")
        assert _validate_file(file) is None

    def test_valid_pdf_uppercase_extension_returns_none(self) -> None:
        """PDF with uppercase extension passes validation."""
        file = FileMetadata(filename="resume.PDF", size_bytes=524288, mime_type="application/pdf")
        assert _validate_file(file) is None

    def test_non_pdf_extension_rejected(self) -> None:
        """Non-PDF extension is rejected."""
        file = FileMetadata(filename="resume.docx", size_bytes=524288, mime_type="application/pdf")
        result = _validate_file(file)
        assert result == "Only PDF files are accepted"

    def test_non_pdf_mime_type_rejected(self) -> None:
        """Non-PDF MIME type is rejected even with .pdf extension."""
        file = FileMetadata(
            filename="resume.pdf",
            size_bytes=524288,
            mime_type="application/msword",
        )
        result = _validate_file(file)
        assert result == "Only PDF files are accepted"

    def test_oversized_file_rejected(self) -> None:
        """File exceeding 10 MB is rejected."""
        file = FileMetadata(
            filename="resume.pdf",
            size_bytes=MAX_FILE_SIZE_BYTES + 1,
            mime_type="application/pdf",
        )
        result = _validate_file(file)
        assert result == "File exceeds the 10 MB size limit"

    def test_exactly_10mb_file_passes(self) -> None:
        """File exactly 10 MB passes validation."""
        file = FileMetadata(
            filename="resume.pdf",
            size_bytes=MAX_FILE_SIZE_BYTES,
            mime_type="application/pdf",
        )
        assert _validate_file(file) is None

    def test_txt_file_rejected(self) -> None:
        """Text file is rejected."""
        file = FileMetadata(filename="resume.txt", size_bytes=1024, mime_type="text/plain")
        result = _validate_file(file)
        assert result == "Only PDF files are accepted"

    def test_no_extension_rejected(self) -> None:
        """File without extension is rejected."""
        file = FileMetadata(filename="resume", size_bytes=1024, mime_type="application/pdf")
        result = _validate_file(file)
        assert result == "Only PDF files are accepted"

    def test_wrong_extension_wrong_mime_rejected(self) -> None:
        """File with wrong extension (checked first) is rejected."""
        file = FileMetadata(
            filename="resume.docx",
            size_bytes=524288,
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        result = _validate_file(file)
        assert result == "Only PDF files are accepted"


# --- Unit Tests: IngestionService ---


class TestIngestionService:
    """Tests for IngestionService business logic."""

    @pytest.mark.asyncio
    async def test_all_valid_files_accepted(self) -> None:
        """All valid PDF files are accepted with upload URLs."""
        mock_session = AsyncMock()
        set_current_org_id(TEST_ORG_ID)

        service = IngestionService(mock_session)

        files = [
            FileMetadata(filename="resume1.pdf", size_bytes=524288, mime_type="application/pdf"),
            FileMetadata(filename="resume2.pdf", size_bytes=1048576, mime_type="application/pdf"),
        ]

        with patch(
            "app.features.ingestion.service._generate_signed_upload_url",
            new_callable=AsyncMock,
            return_value="https://example.com/signed-url",
        ):
            result = await service.validate_and_generate_upload_urls(
                project_id=TEST_PROJECT_ID,
                files=files,
            )

        assert result.accepted_count == 2
        assert result.rejected_count == 0
        assert len(result.results) == 2
        for r in result.results:
            assert r.status == "accepted"

    @pytest.mark.asyncio
    async def test_all_invalid_files_rejected(self) -> None:
        """All invalid files are rejected with reasons."""
        mock_session = AsyncMock()
        set_current_org_id(TEST_ORG_ID)

        service = IngestionService(mock_session)

        files = [
            FileMetadata(filename="resume.docx", size_bytes=524288, mime_type="application/msword"),
            FileMetadata(
                filename="big.pdf",
                size_bytes=MAX_FILE_SIZE_BYTES + 100,
                mime_type="application/pdf",
            ),
        ]

        result = await service.validate_and_generate_upload_urls(
            project_id=TEST_PROJECT_ID,
            files=files,
        )

        assert result.accepted_count == 0
        assert result.rejected_count == 2
        assert result.results[0].status == "rejected"
        assert result.results[0].reason == "Only PDF files are accepted"
        assert result.results[1].status == "rejected"
        assert result.results[1].reason == "File exceeds the 10 MB size limit"

    @pytest.mark.asyncio
    async def test_mixed_files_partial_success(self) -> None:
        """Valid files are accepted while invalid ones are rejected."""
        mock_session = AsyncMock()
        set_current_org_id(TEST_ORG_ID)

        service = IngestionService(mock_session)

        files = [
            FileMetadata(filename="good.pdf", size_bytes=524288, mime_type="application/pdf"),
            FileMetadata(
                filename="bad.docx",
                size_bytes=1048576,
                mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ),
            FileMetadata(filename="also_good.pdf", size_bytes=1024, mime_type="application/pdf"),
        ]

        with patch(
            "app.features.ingestion.service._generate_signed_upload_url",
            new_callable=AsyncMock,
            return_value="https://example.com/signed-url",
        ):
            result = await service.validate_and_generate_upload_urls(
                project_id=TEST_PROJECT_ID,
                files=files,
            )

        assert result.accepted_count == 2
        assert result.rejected_count == 1
        assert result.results[0].status == "accepted"
        assert result.results[0].filename == "good.pdf"
        assert result.results[1].status == "rejected"
        assert result.results[1].filename == "bad.docx"
        assert result.results[2].status == "accepted"
        assert result.results[2].filename == "also_good.pdf"

    @pytest.mark.asyncio
    async def test_accepted_file_has_candidate_id_and_url(self) -> None:
        """Accepted files have a candidate_id UUID and upload_url."""
        mock_session = AsyncMock()
        set_current_org_id(TEST_ORG_ID)

        service = IngestionService(mock_session)

        files = [
            FileMetadata(filename="resume.pdf", size_bytes=524288, mime_type="application/pdf"),
        ]

        with patch(
            "app.features.ingestion.service._generate_signed_upload_url",
            new_callable=AsyncMock,
            return_value="https://storage.example.com/sign/resumes/path?token=abc",
        ):
            result = await service.validate_and_generate_upload_urls(
                project_id=TEST_PROJECT_ID,
                files=files,
            )

        accepted = result.results[0]
        assert accepted.status == "accepted"
        assert accepted.upload_url == "https://storage.example.com/sign/resumes/path?token=abc"
        assert accepted.candidate_id is not None
        # Validate it's a proper UUID
        uuid.UUID(str(accepted.candidate_id))

    @pytest.mark.asyncio
    async def test_candidate_record_created_for_accepted_files(self) -> None:
        """A candidate record and document record are added to the session for each accepted file."""
        mock_session = AsyncMock()
        set_current_org_id(TEST_ORG_ID)

        service = IngestionService(mock_session)

        files = [
            FileMetadata(filename="resume.pdf", size_bytes=524288, mime_type="application/pdf"),
        ]

        with patch(
            "app.features.ingestion.service._generate_signed_upload_url",
            new_callable=AsyncMock,
            return_value="https://example.com/signed-url",
        ):
            await service.validate_and_generate_upload_urls(
                project_id=TEST_PROJECT_ID,
                files=files,
            )

        # session.add should have been called twice (candidate + document)
        assert mock_session.add.call_count == 2
        # session.flush should have been called once
        mock_session.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_url_generation_failure_still_accepts_file(self) -> None:
        """If signed URL generation fails, the file is still accepted with empty URL."""
        mock_session = AsyncMock()
        set_current_org_id(TEST_ORG_ID)

        service = IngestionService(mock_session)

        files = [
            FileMetadata(filename="resume.pdf", size_bytes=524288, mime_type="application/pdf"),
        ]

        with patch(
            "app.features.ingestion.service._generate_signed_upload_url",
            new_callable=AsyncMock,
            side_effect=Exception("Network error"),
        ):
            result = await service.validate_and_generate_upload_urls(
                project_id=TEST_PROJECT_ID,
                files=files,
            )

        assert result.accepted_count == 1
        accepted = result.results[0]
        assert accepted.status == "accepted"
        assert accepted.upload_url == ""


# --- Integration Tests: Router ---


class TestUploadResumesEndpoint:
    """Tests for the POST /api/v1/projects/{project_id}/resumes endpoint."""

    def test_valid_pdf_returns_200_accepted(self, client: TestClient) -> None:
        """Valid PDF file returns 200 with accepted status."""
        with patch(
            "app.features.ingestion.service._generate_signed_upload_url",
            new_callable=AsyncMock,
            return_value="https://example.com/signed-url",
        ):
            response = client.post(
                f"/api/v1/projects/{TEST_PROJECT_ID}/resumes",
                json={"files": [_valid_pdf_file()]},
                headers={"X-CSRF-Token": CSRF_TOKEN},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["accepted_count"] == 1
        assert data["rejected_count"] == 0
        assert data["results"][0]["status"] == "accepted"
        assert "upload_url" in data["results"][0]
        assert "candidate_id" in data["results"][0]

    def test_non_pdf_returns_200_rejected(self, client: TestClient) -> None:
        """Non-PDF file returns 200 with rejected status and reason."""
        response = client.post(
            f"/api/v1/projects/{TEST_PROJECT_ID}/resumes",
            json={"files": [_invalid_docx_file()]},
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["accepted_count"] == 0
        assert data["rejected_count"] == 1
        assert data["results"][0]["status"] == "rejected"
        assert data["results"][0]["reason"] == "Only PDF files are accepted"

    def test_oversized_file_returns_200_rejected(self, client: TestClient) -> None:
        """Oversized file returns 200 with rejected status."""
        response = client.post(
            f"/api/v1/projects/{TEST_PROJECT_ID}/resumes",
            json={
                "files": [
                    {
                        "filename": "big.pdf",
                        "size_bytes": MAX_FILE_SIZE_BYTES + 1,
                        "mime_type": "application/pdf",
                    }
                ]
            },
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["results"][0]["status"] == "rejected"
        assert "10 MB" in data["results"][0]["reason"]

    def test_mixed_batch_returns_partial_success(self, client: TestClient) -> None:
        """Batch with mix of valid and invalid files returns partial success."""
        with patch(
            "app.features.ingestion.service._generate_signed_upload_url",
            new_callable=AsyncMock,
            return_value="https://example.com/signed-url",
        ):
            response = client.post(
                f"/api/v1/projects/{TEST_PROJECT_ID}/resumes",
                json={
                    "files": [
                        _valid_pdf_file("good.pdf"),
                        _invalid_docx_file(),
                        _valid_pdf_file("also_good.pdf"),
                    ]
                },
                headers={"X-CSRF-Token": CSRF_TOKEN},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["accepted_count"] == 2
        assert data["rejected_count"] == 1

    def test_empty_files_list_returns_422(self, client: TestClient) -> None:
        """Empty files list fails schema validation."""
        response = client.post(
            f"/api/v1/projects/{TEST_PROJECT_ID}/resumes",
            json={"files": []},
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )

        # Pydantic validation returns 422
        assert response.status_code == 422

    def test_batch_over_50_files_returns_422(self, client: TestClient) -> None:
        """Batch exceeding 50 files fails schema validation."""
        files = [_valid_pdf_file(f"resume_{i}.pdf") for i in range(51)]
        response = client.post(
            f"/api/v1/projects/{TEST_PROJECT_ID}/resumes",
            json={"files": files},
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )

        assert response.status_code == 422

    def test_exactly_50_files_accepted(self, client: TestClient) -> None:
        """Batch of exactly 50 files passes validation."""
        files = [_valid_pdf_file(f"resume_{i}.pdf") for i in range(50)]
        with patch(
            "app.features.ingestion.service._generate_signed_upload_url",
            new_callable=AsyncMock,
            return_value="https://example.com/signed-url",
        ):
            response = client.post(
                f"/api/v1/projects/{TEST_PROJECT_ID}/resumes",
                json={"files": files},
                headers={"X-CSRF-Token": CSRF_TOKEN},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["accepted_count"] == 50

    def test_missing_request_body_returns_422(self, client: TestClient) -> None:
        """Missing request body returns 422."""
        response = client.post(
            f"/api/v1/projects/{TEST_PROJECT_ID}/resumes",
            json={},
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )

        assert response.status_code == 422
