"""Business logic for Communication (email sending via Resend).

Handles email validation, sending via Resend API, and persistence
of communication records.

Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Sequence
from uuid import UUID

import resend
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security.exceptions import NotFoundException, ValidationException
from app.features.candidates.repository import CandidateRepository
from app.features.communication.repository import CommunicationRepository
from app.models.candidate_communications import CandidateCommunication

logger = logging.getLogger(__name__)


class CommunicationService:
    """Service layer for communication operations (email sending)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = CommunicationRepository(session)
        self.candidate_repository = CandidateRepository(session)

    async def send_email(
        self,
        candidate_id: UUID,
        hiring_project_id: UUID,
        subject: str,
        body: str,
        sender_id: str,
    ) -> CandidateCommunication:
        """Send an email to a candidate via Resend.

        Validates the candidate exists and has an email, sends via Resend API,
        and stores the communication record.

        On success: stores with delivery_status="sent" and resend_message_id.
        On failure: stores with delivery_status="failed", preserves content.

        Args:
            candidate_id: UUID of the recipient candidate.
            hiring_project_id: UUID of the hiring project.
            subject: Email subject (already validated by schema).
            body: Email body (already validated by schema).
            sender_id: ID of the authenticated user sending the email.

        Returns:
            The created CandidateCommunication record.

        Raises:
            NotFoundException: If candidate does not exist.
            ValidationException: If candidate has no email address.
        """
        # Validate candidate exists (org-scoped)
        candidate = await self.candidate_repository.get_by_id(candidate_id)
        if candidate is None:
            raise NotFoundException(
                message="The specified candidate was not found"
            )

        # Validate candidate has an email address
        if not candidate.email:
            raise ValidationException(
                message="Candidate does not have an email address on file",
                details=[
                    {
                        "field": "candidate_id",
                        "message": "The candidate does not have an email address",
                    }
                ],
            )

        settings = get_settings()
        recipient_email = candidate.email

        # Attempt to send via Resend
        delivery_status = "sent"
        resend_message_id = None
        sent_at = None

        try:
            resend.api_key = settings.resend_api_key

            email_response = resend.Emails.send(
                {
                    "from": settings.resend_from_email,
                    "to": [recipient_email],
                    "subject": subject,
                    "text": body,
                }
            )

            # Extract message ID from Resend response
            if isinstance(email_response, dict):
                resend_message_id = email_response.get("id")
            sent_at = datetime.now(timezone.utc)

        except Exception as e:
            logger.error(
                "Failed to send email to %s for candidate %s: %s",
                recipient_email,
                candidate_id,
                str(e),
            )
            delivery_status = "failed"

        # Store the communication record regardless of send success/failure
        communication = await self.repository.create(
            candidate_id=candidate_id,
            hiring_project_id=hiring_project_id,
            sender_id=sender_id,
            recipient_email=recipient_email,
            subject=subject,
            body=body,
            delivery_status=delivery_status,
            resend_message_id=resend_message_id,
            sent_at=sent_at,
        )

        return communication

    async def get_project_history(
        self,
        project_id: UUID,
    ) -> Sequence[CandidateCommunication]:
        """Get communication history for a hiring project.

        Returns all communications ordered by most recent first.

        Args:
            project_id: UUID of the hiring project.

        Returns:
            List of communication records ordered by sent_at DESC.
        """
        return await self.repository.list_by_project(project_id)
