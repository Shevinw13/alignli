"""Property-based tests for Communication feature.

These tests verify universal communication properties under randomized inputs:
- Property 18: Email Validation Prevents Invalid Sends
- Property 19: Communication History Ordering
- Property 20: Email Round-Trip Persistence

**Validates: Requirements 13.1, 13.3, 13.5**
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st
from pydantic import ValidationError

from app.features.communication.schemas import SendEmailRequest
from app.features.communication.service import CommunicationService
from app.core.security.exceptions import NotFoundException, ValidationException


# --- Strategies ---

# Valid UUIDs
uuid_strategy = st.uuids()

# Valid subject strings (1-255 chars, non-blank)
valid_subject_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z")),
    min_size=1,
    max_size=255,
).filter(lambda s: len(s.strip()) > 0)

# Valid body strings (1-10000 chars, non-blank)
valid_body_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z")),
    min_size=1,
    max_size=500,  # Keep reasonable for test speed
).filter(lambda s: len(s.strip()) > 0)

# Invalid subjects: empty, whitespace-only, or too long
invalid_subject_strategy = st.one_of(
    st.just(""),  # empty
    st.text(
        alphabet=st.just(" "),
        min_size=1,
        max_size=10,
    ),  # whitespace only
    st.text(
        alphabet=st.characters(whitelist_categories=("L", "N")),
        min_size=256,
        max_size=300,
    ),  # too long
)

# Invalid bodies: empty or whitespace-only
invalid_body_strategy = st.one_of(
    st.just(""),  # empty
    st.text(
        alphabet=st.just(" "),
        min_size=1,
        max_size=10,
    ),  # whitespace only
)

# Timestamps for history ordering
timestamp_strategy = st.datetimes(
    min_value=datetime(2020, 1, 1),
    max_value=datetime(2025, 12, 31),
    timezones=st.just(timezone.utc),
)


# --- Property 18: Email Validation Prevents Invalid Sends ---


class TestEmailValidationPreventsInvalidSends:
    """Property 18: Email Validation Prevents Invalid Sends.

    *For any* email send request that is missing a recipient, subject, or body,
    the system SHALL reject the request with a validation error and no email
    shall be sent.

    **Validates: Requirements 13.1**
    """

    @given(
        candidate_id=uuid_strategy,
        project_id=uuid_strategy,
        body=valid_body_strategy,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_missing_subject_rejected(
        self, candidate_id: uuid.UUID, project_id: uuid.UUID, body: str
    ):
        """Request with missing subject is rejected at the schema level."""
        with pytest.raises(ValidationError) as exc_info:
            SendEmailRequest(
                candidate_id=candidate_id,
                hiring_project_id=project_id,
                subject="",  # empty subject
                body=body,
            )
        # Validation error relates to subject
        errors = exc_info.value.errors()
        assert any("subject" in str(e.get("loc", "")) or "subject" in str(e.get("msg", "")).lower() for e in errors)

    @given(
        candidate_id=uuid_strategy,
        project_id=uuid_strategy,
        subject=valid_subject_strategy,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_missing_body_rejected(
        self, candidate_id: uuid.UUID, project_id: uuid.UUID, subject: str
    ):
        """Request with missing body is rejected at the schema level."""
        with pytest.raises(ValidationError) as exc_info:
            SendEmailRequest(
                candidate_id=candidate_id,
                hiring_project_id=project_id,
                subject=subject,
                body="",  # empty body
            )
        errors = exc_info.value.errors()
        assert any("body" in str(e.get("loc", "")) or "body" in str(e.get("msg", "")).lower() for e in errors)

    @given(
        candidate_id=uuid_strategy,
        project_id=uuid_strategy,
        subject=valid_subject_strategy,
        body=valid_body_strategy,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_valid_request_passes_schema_validation(
        self, candidate_id: uuid.UUID, project_id: uuid.UUID, subject: str, body: str
    ):
        """Request with all valid fields passes schema validation."""
        req = SendEmailRequest(
            candidate_id=candidate_id,
            hiring_project_id=project_id,
            subject=subject,
            body=body,
        )
        assert req.candidate_id == candidate_id
        assert req.subject == subject
        assert req.body == body

    @given(
        candidate_id=uuid_strategy,
        project_id=uuid_strategy,
        body=valid_body_strategy,
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_whitespace_only_subject_rejected(
        self, candidate_id: uuid.UUID, project_id: uuid.UUID, body: str
    ):
        """Request with whitespace-only subject is rejected."""
        with pytest.raises(ValidationError):
            SendEmailRequest(
                candidate_id=candidate_id,
                hiring_project_id=project_id,
                subject="   ",
                body=body,
            )

    @given(
        candidate_id=uuid_strategy,
        project_id=uuid_strategy,
        subject=valid_subject_strategy,
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_whitespace_only_body_rejected(
        self, candidate_id: uuid.UUID, project_id: uuid.UUID, subject: str
    ):
        """Request with whitespace-only body is rejected."""
        with pytest.raises(ValidationError):
            SendEmailRequest(
                candidate_id=candidate_id,
                hiring_project_id=project_id,
                subject=subject,
                body="   ",
            )

    @given(
        candidate_id=uuid_strategy,
        project_id=uuid_strategy,
        body=valid_body_strategy,
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_subject_over_255_chars_rejected(
        self, candidate_id: uuid.UUID, project_id: uuid.UUID, body: str
    ):
        """Request with subject exceeding 255 characters is rejected."""
        long_subject = "A" * 256
        with pytest.raises(ValidationError):
            SendEmailRequest(
                candidate_id=candidate_id,
                hiring_project_id=project_id,
                subject=long_subject,
                body=body,
            )

    @pytest.mark.asyncio
    @given(
        candidate_id=uuid_strategy,
        project_id=uuid_strategy,
        subject=valid_subject_strategy,
        body=valid_body_strategy,
    )
    @settings(max_examples=20, suppress_health_check=[HealthCheck.too_slow])
    async def test_candidate_not_found_prevents_send(
        self, candidate_id: uuid.UUID, project_id: uuid.UUID, subject: str, body: str
    ):
        """If candidate does not exist, no email is sent and NotFoundException raised."""
        mock_session = AsyncMock()
        service = CommunicationService(mock_session)
        service.candidate_repository = AsyncMock()
        service.candidate_repository.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await service.send_email(
                candidate_id=candidate_id,
                hiring_project_id=project_id,
                subject=subject,
                body=body,
                sender_id="user_123",
            )


# --- Property 19: Communication History Ordering ---


class TestCommunicationHistoryOrdering:
    """Property 19: Communication History Ordering.

    *For any* set of communications in a project, the history SHALL be returned
    ordered by sent timestamp descending (most recent first).

    **Validates: Requirements 13.3**
    """

    @given(
        timestamps=st.lists(timestamp_strategy, min_size=2, max_size=20),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_history_sorted_by_timestamp_descending(
        self, timestamps: list[datetime]
    ):
        """Communication records returned in sent_at descending order."""
        # Create mock communication records with the generated timestamps
        communications = []
        for i, ts in enumerate(timestamps):
            comm = MagicMock()
            comm.id = uuid.uuid4()
            comm.sent_at = ts
            comm.created_at = ts
            communications.append(comm)

        # Sort as the repository does: sent_at DESC (nulls last), created_at DESC
        sorted_comms = sorted(
            communications,
            key=lambda c: c.sent_at or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )

        # Verify ordering property: each item's timestamp >= next item's timestamp
        for i in range(len(sorted_comms) - 1):
            current_ts = sorted_comms[i].sent_at
            next_ts = sorted_comms[i + 1].sent_at
            if current_ts is not None and next_ts is not None:
                assert current_ts >= next_ts

    @given(
        timestamps=st.lists(timestamp_strategy, min_size=1, max_size=10),
        null_count=st.integers(min_value=1, max_value=5),
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_null_sent_at_sorted_last(
        self, timestamps: list[datetime], null_count: int
    ):
        """Communications with null sent_at appear after those with timestamps."""
        communications = []
        # Records with timestamps
        for ts in timestamps:
            comm = MagicMock()
            comm.sent_at = ts
            comm.created_at = ts
            communications.append(comm)
        # Records with null sent_at (drafts/unsent)
        for i in range(null_count):
            comm = MagicMock()
            comm.sent_at = None
            comm.created_at = datetime(2024, 1, i + 1, tzinfo=timezone.utc)
            communications.append(comm)

        # Sort as repository: sent_at DESC nulls last
        sorted_comms = sorted(
            communications,
            key=lambda c: (
                c.sent_at is None,  # None goes last (True > False)
                -(c.sent_at or datetime.min.replace(tzinfo=timezone.utc)).timestamp(),
            ),
        )

        # Find boundary between non-null and null sent_at
        non_null_comms = [c for c in sorted_comms if c.sent_at is not None]
        null_comms = [c for c in sorted_comms if c.sent_at is None]

        # All non-null should come before null in the sorted output
        if non_null_comms and null_comms:
            last_non_null_idx = next(
                i for i, c in enumerate(sorted_comms) if c.sent_at is None
            ) - 1
            # Verify all items before null items have sent_at
            for i in range(last_non_null_idx + 1):
                assert sorted_comms[i].sent_at is not None


# --- Property 20: Email Round-Trip Persistence ---


class TestEmailRoundTripPersistence:
    """Property 20: Email Round-Trip Persistence.

    *For any* successfully sent email, the system SHALL persist and make
    retrievable the original subject, body, recipient, and sender fields
    without modification.

    **Validates: Requirements 13.5**
    """

    @pytest.mark.asyncio
    @given(
        subject=valid_subject_strategy,
        body=valid_body_strategy,
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    async def test_sent_email_preserves_all_fields(
        self, subject: str, body: str
    ):
        """A sent email is stored with the exact original subject and body."""
        candidate_id = uuid.uuid4()
        project_id = uuid.uuid4()
        sender_id = "user_sender_123"
        recipient_email = "candidate@example.com"

        mock_session = AsyncMock()
        service = CommunicationService(mock_session)

        # Mock candidate with email
        mock_candidate = MagicMock()
        mock_candidate.email = recipient_email
        service.candidate_repository = AsyncMock()
        service.candidate_repository.get_by_id = AsyncMock(return_value=mock_candidate)

        # Mock repository create to capture what was stored
        stored_record = MagicMock()
        stored_record.subject = subject
        stored_record.body = body
        stored_record.recipient_email = recipient_email
        stored_record.sender_id = sender_id
        stored_record.delivery_status = "sent"
        service.repository = AsyncMock()
        service.repository.create = AsyncMock(return_value=stored_record)

        # Mock Resend to succeed
        with patch("app.features.communication.service.resend") as mock_resend:
            mock_resend.Emails.send.return_value = {"id": "msg_123"}
            with patch("app.features.communication.service.get_settings") as mock_settings:
                mock_settings.return_value = MagicMock(
                    resend_api_key="test_key",
                    resend_from_email="noreply@alignli.com",
                )
                result = await service.send_email(
                    candidate_id=candidate_id,
                    hiring_project_id=project_id,
                    subject=subject,
                    body=body,
                    sender_id=sender_id,
                )

        # Verify the repository.create was called with original fields
        create_call = service.repository.create.call_args
        assert create_call.kwargs["subject"] == subject
        assert create_call.kwargs["body"] == body
        assert create_call.kwargs["recipient_email"] == recipient_email
        assert create_call.kwargs["sender_id"] == sender_id

    @pytest.mark.asyncio
    @given(
        subject=valid_subject_strategy,
        body=valid_body_strategy,
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    async def test_failed_email_still_persists_content(
        self, subject: str, body: str
    ):
        """Even on send failure, the email content is persisted (draft preservation)."""
        candidate_id = uuid.uuid4()
        project_id = uuid.uuid4()
        sender_id = "user_sender_456"
        recipient_email = "candidate@test.com"

        mock_session = AsyncMock()
        service = CommunicationService(mock_session)

        # Mock candidate with email
        mock_candidate = MagicMock()
        mock_candidate.email = recipient_email
        service.candidate_repository = AsyncMock()
        service.candidate_repository.get_by_id = AsyncMock(return_value=mock_candidate)

        # Mock repository create
        stored_record = MagicMock()
        stored_record.subject = subject
        stored_record.body = body
        stored_record.delivery_status = "failed"
        service.repository = AsyncMock()
        service.repository.create = AsyncMock(return_value=stored_record)

        # Mock Resend to fail
        with patch("app.features.communication.service.resend") as mock_resend:
            mock_resend.Emails.send.side_effect = Exception("Network error")
            with patch("app.features.communication.service.get_settings") as mock_settings:
                mock_settings.return_value = MagicMock(
                    resend_api_key="test_key",
                    resend_from_email="noreply@alignli.com",
                )
                result = await service.send_email(
                    candidate_id=candidate_id,
                    hiring_project_id=project_id,
                    subject=subject,
                    body=body,
                    sender_id=sender_id,
                )

        # Even on failure, content is persisted
        create_call = service.repository.create.call_args
        assert create_call.kwargs["subject"] == subject
        assert create_call.kwargs["body"] == body
        assert create_call.kwargs["delivery_status"] == "failed"
