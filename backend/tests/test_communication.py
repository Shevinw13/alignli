"""Tests for Communication feature (email sending via Resend).

Tests cover:
- Email send endpoint validation (missing fields, length constraints)
- Successful email sending via Resend
- Email delivery failure handling (preserves draft)
- Communication history retrieval ordered by most recent first
- Candidate not found and missing email cases

Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.database.session import set_current_org_id
from app.core.middleware.auth import AuthenticatedUser
from app.core.security.exceptions import NotFoundException, ValidationException
from app.features.communication.service import CommunicationService
from app.main import app

# --- Constants ---

TEST_ORG_ID = str(uuid.uuid4())
TEST_USER_ID = str(uuid.uuid4())
TEST_PROJECT_ID = uuid.uuid4()
TEST_CANDIDATE_ID = uuid.uuid4()

CSRF_TOKEN = "test-csrf-token-for-comms-testing"


# --- Helpers ---


def _mock_user() -> AuthenticatedUser:
    """Create a mock authenticated user."""
    return AuthenticatedUser(
        user_id=TEST_USER_ID,
        org_id=TEST_ORG_ID,
        role="Hiring_Manager",
    )


def _mock_communication(
    comm_id: uuid.UUID | None = None,
    candidate_id: uuid.UUID | None = None,
    delivery_status: str = "sent",
    resend_message_id: str | None = "resend_msg_123",
    sent_at: datetime | None = None,
) -> MagicMock:
    """Create a mock CandidateCommunication object."""
    comm = MagicMock()
    comm.id = comm_id or uuid.uuid4()
    comm.candidate_id = candidate_id or TEST_CANDIDATE_ID
    comm.hiring_project_id = TEST_PROJECT_ID
    comm.organization_id = uuid.UUID(TEST_ORG_ID)
    comm.sender_id = uuid.UUID(TEST_USER_ID)
    comm.recipient_email = "candidate@example.com"
    comm.subject = "Interview Invitation"
    comm.body = "We'd like to invite you for an interview."
    comm.delivery_status = delivery_status
    comm.resend_message_id = resend_message_id
    comm.sent_at = sent_at or datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
    comm.created_at = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
    return comm


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


# --- Schema Validation Tests ---


class TestSendEmailValidation:
    """Tests for request validation on the send email endpoint."""

    def test_missing_candidate_id_returns_422(self, client: TestClient) -> None:
        """Missing candidate_id in request body returns 422."""
        response = client.post(
            "/api/v1/communication/send",
            json={
                "hiring_project_id": str(TEST_PROJECT_ID),
                "subject": "Hello",
                "body": "Test body",
            },
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        assert response.status_code == 422

    def test_missing_subject_returns_422(self, client: TestClient) -> None:
        """Missing subject in request body returns 422."""
        response = client.post(
            "/api/v1/communication/send",
            json={
                "candidate_id": str(TEST_CANDIDATE_ID),
                "hiring_project_id": str(TEST_PROJECT_ID),
                "body": "Test body",
            },
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        assert response.status_code == 422

    def test_missing_body_returns_422(self, client: TestClient) -> None:
        """Missing body in request body returns 422."""
        response = client.post(
            "/api/v1/communication/send",
            json={
                "candidate_id": str(TEST_CANDIDATE_ID),
                "hiring_project_id": str(TEST_PROJECT_ID),
                "subject": "Hello",
            },
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        assert response.status_code == 422

    def test_empty_subject_returns_422(self, client: TestClient) -> None:
        """Empty subject string returns 422."""
        response = client.post(
            "/api/v1/communication/send",
            json={
                "candidate_id": str(TEST_CANDIDATE_ID),
                "hiring_project_id": str(TEST_PROJECT_ID),
                "subject": "",
                "body": "Test body",
            },
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        assert response.status_code == 422

    def test_empty_body_returns_422(self, client: TestClient) -> None:
        """Empty body string returns 422."""
        response = client.post(
            "/api/v1/communication/send",
            json={
                "candidate_id": str(TEST_CANDIDATE_ID),
                "hiring_project_id": str(TEST_PROJECT_ID),
                "subject": "Hello",
                "body": "",
            },
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        assert response.status_code == 422

    def test_subject_over_255_chars_returns_422(self, client: TestClient) -> None:
        """Subject exceeding 255 characters returns 422."""
        response = client.post(
            "/api/v1/communication/send",
            json={
                "candidate_id": str(TEST_CANDIDATE_ID),
                "hiring_project_id": str(TEST_PROJECT_ID),
                "subject": "A" * 256,
                "body": "Test body",
            },
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        assert response.status_code == 422

    def test_body_over_10000_chars_returns_422(self, client: TestClient) -> None:
        """Body exceeding 10,000 characters returns 422."""
        response = client.post(
            "/api/v1/communication/send",
            json={
                "candidate_id": str(TEST_CANDIDATE_ID),
                "hiring_project_id": str(TEST_PROJECT_ID),
                "subject": "Hello",
                "body": "A" * 10001,
            },
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        assert response.status_code == 422

    def test_whitespace_only_subject_returns_422(self, client: TestClient) -> None:
        """Subject with only whitespace returns 422."""
        response = client.post(
            "/api/v1/communication/send",
            json={
                "candidate_id": str(TEST_CANDIDATE_ID),
                "hiring_project_id": str(TEST_PROJECT_ID),
                "subject": "   ",
                "body": "Test body",
            },
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        assert response.status_code == 422

    def test_whitespace_only_body_returns_422(self, client: TestClient) -> None:
        """Body with only whitespace returns 422."""
        response = client.post(
            "/api/v1/communication/send",
            json={
                "candidate_id": str(TEST_CANDIDATE_ID),
                "hiring_project_id": str(TEST_PROJECT_ID),
                "subject": "Hello",
                "body": "   ",
            },
            headers={"X-CSRF-Token": CSRF_TOKEN},
        )
        assert response.status_code == 422


# --- Send Email Endpoint Tests ---


class TestSendEmailEndpoint:
    """Tests for the POST /api/v1/communication/send endpoint."""

    def test_successful_send_returns_200(self, client: TestClient) -> None:
        """Successful email send returns 200 with communication record."""
        mock_comm = _mock_communication()

        with patch(
            "app.features.communication.service.CommunicationService.send_email"
        ) as mock_send:
            mock_send.return_value = mock_comm

            response = client.post(
                "/api/v1/communication/send",
                json={
                    "candidate_id": str(TEST_CANDIDATE_ID),
                    "hiring_project_id": str(TEST_PROJECT_ID),
                    "subject": "Interview Invitation",
                    "body": "We'd like to invite you for an interview.",
                },
                headers={"X-CSRF-Token": CSRF_TOKEN},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Email sent successfully"
        assert data["communication"]["delivery_status"] == "sent"
        assert data["communication"]["subject"] == "Interview Invitation"
        assert data["communication"]["recipient_email"] == "candidate@example.com"

    def test_failed_send_returns_200_with_failure_message(
        self, client: TestClient
    ) -> None:
        """Failed email delivery returns 200 with failure message and preserved content."""
        mock_comm = _mock_communication(
            delivery_status="failed",
            resend_message_id=None,
            sent_at=None,
        )

        with patch(
            "app.features.communication.service.CommunicationService.send_email"
        ) as mock_send:
            mock_send.return_value = mock_comm

            response = client.post(
                "/api/v1/communication/send",
                json={
                    "candidate_id": str(TEST_CANDIDATE_ID),
                    "hiring_project_id": str(TEST_PROJECT_ID),
                    "subject": "Interview Invitation",
                    "body": "We'd like to invite you for an interview.",
                },
                headers={"X-CSRF-Token": CSRF_TOKEN},
            )

        assert response.status_code == 200
        data = response.json()
        assert "failed" in data["message"].lower()
        assert data["communication"]["delivery_status"] == "failed"
        # Content is preserved
        assert data["communication"]["subject"] == "Interview Invitation"
        assert data["communication"]["body"] == "We'd like to invite you for an interview."

    def test_candidate_not_found_returns_404(self, client: TestClient) -> None:
        """Candidate not found returns 404."""
        with patch(
            "app.features.communication.service.CommunicationService.send_email"
        ) as mock_send:
            mock_send.side_effect = NotFoundException(
                message="The specified candidate was not found"
            )

            response = client.post(
                "/api/v1/communication/send",
                json={
                    "candidate_id": str(uuid.uuid4()),
                    "hiring_project_id": str(TEST_PROJECT_ID),
                    "subject": "Hello",
                    "body": "Test body",
                },
                headers={"X-CSRF-Token": CSRF_TOKEN},
            )

        assert response.status_code == 404

    def test_candidate_no_email_returns_400(self, client: TestClient) -> None:
        """Candidate without email address returns 400 validation error."""
        with patch(
            "app.features.communication.service.CommunicationService.send_email"
        ) as mock_send:
            mock_send.side_effect = ValidationException(
                message="Candidate does not have an email address on file",
                details=[
                    {
                        "field": "candidate_id",
                        "message": "The candidate does not have an email address",
                    }
                ],
            )

            response = client.post(
                "/api/v1/communication/send",
                json={
                    "candidate_id": str(TEST_CANDIDATE_ID),
                    "hiring_project_id": str(TEST_PROJECT_ID),
                    "subject": "Hello",
                    "body": "Test body",
                },
                headers={"X-CSRF-Token": CSRF_TOKEN},
            )

        assert response.status_code == 400


# --- Communication History Endpoint Tests ---


class TestCommunicationHistoryEndpoint:
    """Tests for the GET /api/v1/communication/{project_id} endpoint."""

    def test_get_history_returns_200_with_items(self, client: TestClient) -> None:
        """Get communication history returns 200 with ordered items."""
        comm1 = _mock_communication()
        comm2 = _mock_communication(
            comm_id=uuid.uuid4(),
            delivery_status="failed",
            resend_message_id=None,
        )
        comm2.subject = "Follow Up"
        comm2.sent_at = datetime(2024, 1, 16, 10, 0, 0, tzinfo=timezone.utc)
        comm2.created_at = datetime(2024, 1, 16, 10, 0, 0, tzinfo=timezone.utc)

        with patch(
            "app.features.communication.service.CommunicationService.get_project_history"
        ) as mock_history:
            mock_history.return_value = [comm2, comm1]  # Most recent first

            response = client.get(
                f"/api/v1/communication/{TEST_PROJECT_ID}",
            )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["items"][0]["subject"] == "Follow Up"
        assert data["items"][1]["subject"] == "Interview Invitation"

    def test_get_history_empty_project_returns_empty_list(
        self, client: TestClient
    ) -> None:
        """Get history for a project with no communications returns empty list."""
        with patch(
            "app.features.communication.service.CommunicationService.get_project_history"
        ) as mock_history:
            mock_history.return_value = []

            response = client.get(
                f"/api/v1/communication/{TEST_PROJECT_ID}",
            )

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []


# --- Service Unit Tests ---


class TestCommunicationService:
    """Unit tests for CommunicationService business logic."""

    @pytest.mark.asyncio
    async def test_send_email_candidate_not_found_raises(self) -> None:
        """send_email raises NotFoundException when candidate doesn't exist."""
        mock_session = AsyncMock()
        service = CommunicationService(mock_session)
        service.candidate_repository = AsyncMock()
        service.candidate_repository.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await service.send_email(
                candidate_id=uuid.uuid4(),
                hiring_project_id=TEST_PROJECT_ID,
                subject="Hello",
                body="Test body",
                sender_id=TEST_USER_ID,
            )

    @pytest.mark.asyncio
    async def test_send_email_candidate_no_email_raises(self) -> None:
        """send_email raises ValidationException when candidate has no email."""
        mock_session = AsyncMock()
        service = CommunicationService(mock_session)

        # Mock candidate with no email
        mock_candidate = MagicMock()
        mock_candidate.email = None
        service.candidate_repository = AsyncMock()
        service.candidate_repository.get_by_id = AsyncMock(return_value=mock_candidate)

        with pytest.raises(ValidationException):
            await service.send_email(
                candidate_id=TEST_CANDIDATE_ID,
                hiring_project_id=TEST_PROJECT_ID,
                subject="Hello",
                body="Test body",
                sender_id=TEST_USER_ID,
            )

    @pytest.mark.asyncio
    async def test_send_email_success_stores_sent_status(self) -> None:
        """Successful Resend send stores communication with status 'sent'."""
        mock_session = AsyncMock()
        service = CommunicationService(mock_session)

        # Mock candidate with email
        mock_candidate = MagicMock()
        mock_candidate.email = "candidate@example.com"
        service.candidate_repository = AsyncMock()
        service.candidate_repository.get_by_id = AsyncMock(return_value=mock_candidate)

        # Mock repository create
        created_comm = _mock_communication()
        service.repository = AsyncMock()
        service.repository.create = AsyncMock(return_value=created_comm)

        with patch("app.features.communication.service.resend") as mock_resend:
            mock_resend.Emails.send.return_value = {"id": "resend_msg_abc123"}

            result = await service.send_email(
                candidate_id=TEST_CANDIDATE_ID,
                hiring_project_id=TEST_PROJECT_ID,
                subject="Interview Invitation",
                body="We'd like to invite you.",
                sender_id=TEST_USER_ID,
            )

        # Verify create was called with sent status
        service.repository.create.assert_called_once()
        call_kwargs = service.repository.create.call_args.kwargs
        assert call_kwargs["delivery_status"] == "sent"
        assert call_kwargs["resend_message_id"] == "resend_msg_abc123"
        assert call_kwargs["sent_at"] is not None

    @pytest.mark.asyncio
    async def test_send_email_failure_stores_failed_status(self) -> None:
        """Failed Resend send stores communication with status 'failed'."""
        mock_session = AsyncMock()
        service = CommunicationService(mock_session)

        # Mock candidate with email
        mock_candidate = MagicMock()
        mock_candidate.email = "candidate@example.com"
        service.candidate_repository = AsyncMock()
        service.candidate_repository.get_by_id = AsyncMock(return_value=mock_candidate)

        # Mock repository create
        failed_comm = _mock_communication(delivery_status="failed")
        service.repository = AsyncMock()
        service.repository.create = AsyncMock(return_value=failed_comm)

        with patch("app.features.communication.service.resend") as mock_resend:
            mock_resend.Emails.send.side_effect = Exception("API Error")

            result = await service.send_email(
                candidate_id=TEST_CANDIDATE_ID,
                hiring_project_id=TEST_PROJECT_ID,
                subject="Interview Invitation",
                body="We'd like to invite you.",
                sender_id=TEST_USER_ID,
            )

        # Verify create was called with failed status and preserved content
        service.repository.create.assert_called_once()
        call_kwargs = service.repository.create.call_args.kwargs
        assert call_kwargs["delivery_status"] == "failed"
        assert call_kwargs["resend_message_id"] is None
        assert call_kwargs["sent_at"] is None
        assert call_kwargs["subject"] == "Interview Invitation"
        assert call_kwargs["body"] == "We'd like to invite you."

    @pytest.mark.asyncio
    async def test_get_project_history_delegates_to_repository(self) -> None:
        """get_project_history delegates to repository list_by_project."""
        mock_session = AsyncMock()
        service = CommunicationService(mock_session)
        service.repository = AsyncMock()
        service.repository.list_by_project = AsyncMock(return_value=[])

        result = await service.get_project_history(TEST_PROJECT_ID)

        service.repository.list_by_project.assert_called_once_with(TEST_PROJECT_ID)
        assert result == []
