"""Pydantic schemas for Communication API.

Defines request/response models for email sending and history retrieval.

Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class SendEmailRequest(BaseModel):
    """Request schema for sending an email to a candidate.

    Validates:
    - candidate_id: required, valid UUID
    - hiring_project_id: required, valid UUID
    - subject: required, max 255 characters
    - body: required, max 10,000 characters, non-empty
    """

    candidate_id: uuid.UUID = Field(..., description="UUID of the recipient candidate")
    hiring_project_id: uuid.UUID = Field(..., description="UUID of the hiring project")
    subject: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Email subject (max 255 characters)",
    )
    body: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Email body (max 10,000 characters)",
    )

    @field_validator("subject")
    @classmethod
    def subject_not_blank(cls, v: str) -> str:
        """Ensure subject is not blank after stripping whitespace."""
        if not v.strip():
            raise ValueError("Subject cannot be blank")
        return v

    @field_validator("body")
    @classmethod
    def body_not_blank(cls, v: str) -> str:
        """Ensure body is not blank after stripping whitespace."""
        if not v.strip():
            raise ValueError("Body cannot be blank")
        return v


class CommunicationResponse(BaseModel):
    """Response schema for a single communication record."""

    id: uuid.UUID
    candidate_id: uuid.UUID
    sender_id: uuid.UUID
    recipient_email: str
    subject: str
    body: str
    delivery_status: str
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CommunicationListResponse(BaseModel):
    """Response schema for communication history list."""

    items: list[CommunicationResponse]


class SendEmailResponse(BaseModel):
    """Response schema for the send email endpoint."""

    communication: CommunicationResponse
    message: str = "Email sent successfully"
