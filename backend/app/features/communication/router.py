"""API routes for Communication (email sending and history).

Endpoints:
- POST /api/v1/communication/send — Send an email to a candidate
- GET /api/v1/communication/{project_id} — Get email history for a project

Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_db
from app.core.middleware.auth import AuthenticatedUser, get_current_user
from app.features.communication.schemas import (
    CommunicationListResponse,
    CommunicationResponse,
    SendEmailRequest,
    SendEmailResponse,
)
from app.features.communication.service import CommunicationService

router = APIRouter(
    prefix="/communication",
    tags=["Communication"],
)


def _get_service(session: AsyncSession = Depends(get_db)) -> CommunicationService:
    """Dependency to create CommunicationService with the current session."""
    return CommunicationService(session)


@router.post("/send", response_model=SendEmailResponse)
async def send_email(
    request: SendEmailRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    service: CommunicationService = Depends(_get_service),
) -> SendEmailResponse:
    """Send an email to a candidate.

    Validates the request, sends via Resend API, and stores the record.
    On failure, the communication record is still stored with delivery_status="failed"
    to preserve draft content.

    Returns the communication record with delivery status.
    """
    communication = await service.send_email(
        candidate_id=request.candidate_id,
        hiring_project_id=request.hiring_project_id,
        subject=request.subject,
        body=request.body,
        sender_id=user.user_id,
    )

    response_item = CommunicationResponse.model_validate(communication)

    message = "Email sent successfully"
    if communication.delivery_status == "failed":
        message = "Email delivery failed. Draft content has been preserved."

    return SendEmailResponse(
        communication=response_item,
        message=message,
    )


@router.get("/{project_id}", response_model=CommunicationListResponse)
async def get_communication_history(
    project_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    service: CommunicationService = Depends(_get_service),
) -> CommunicationListResponse:
    """Get email history for a hiring project.

    Returns all communications ordered by most recent first (sent_at DESC).
    """
    communications = await service.get_project_history(project_id)

    items = [
        CommunicationResponse.model_validate(comm)
        for comm in communications
    ]

    return CommunicationListResponse(items=items)
