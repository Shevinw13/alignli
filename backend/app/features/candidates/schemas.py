"""Pydantic schemas for Candidate API.

Defines request/response models for candidate listing, profile, and hire endpoints.

Requirements: 10.1, 10.6, 10.7, 11.1, 14.1, 14.2, 14.3, 14.7, 19.5
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ConfidenceLevel(str, Enum):
    """Valid confidence level values."""

    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class CandidateListFilters(BaseModel):
    """Query parameter filters for candidate list endpoint."""

    min_score: Optional[int] = Field(
        None,
        ge=0,
        le=100,
        description="Minimum match score (0-100)",
    )
    max_score: Optional[int] = Field(
        None,
        ge=0,
        le=100,
        description="Maximum match score (0-100)",
    )
    confidence: Optional[ConfidenceLevel] = Field(
        None,
        description="Filter by confidence level (High, Medium, Low)",
    )


class CandidateCardResponse(BaseModel):
    """Response schema for a candidate card in the list view.

    Shows summary information for the ranked candidate list.
    """

    id: uuid.UUID
    full_name: Optional[str] = None
    current_company: Optional[str] = None
    location: Optional[str] = None
    years_experience: Optional[int] = None
    match_score: Optional[int] = None
    confidence_level: Optional[str] = None
    summary: Optional[str] = Field(
        None,
        description="First 150 characters of the AI summary",
    )
    processing_status: str

    model_config = {"from_attributes": True}


class CandidateListResponse(BaseModel):
    """Response schema for paginated candidate list."""

    items: list[CandidateCardResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class CandidateProfileResponse(BaseModel):
    """Response schema for the full candidate profile.

    Includes all candidate fields, parsed data, AI-generated content.
    """

    id: uuid.UUID
    hiring_project_id: uuid.UUID
    organization_id: uuid.UUID
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    website_url: Optional[str] = None
    current_company: Optional[str] = None
    location: Optional[str] = None
    years_experience: Optional[int] = None
    match_score: Optional[int] = None
    confidence_level: Optional[str] = None
    processing_status: str
    status: str
    parsed_data: Optional[dict[str, Any]] = None
    summary: Optional[str] = None
    strengths: Optional[list[Any]] = None
    concerns: Optional[list[Any]] = None
    interview_questions: Optional[list[Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HireCandidateResponse(BaseModel):
    """Response schema for the hire candidate endpoint.

    Returns the updated candidate data along with a flag indicating
    whether the project can be transitioned to Filled state.
    """

    candidate: CandidateProfileResponse
    project_fillable: bool = Field(
        description="Whether the project can be transitioned to Filled state"
    )


# ---------------------------------------------------------------------------
# Add candidates from text
# ---------------------------------------------------------------------------


class CandidateTextEntry(BaseModel):
    """A single candidate's text content to be ingested."""

    text: str = Field(..., min_length=1, description="Raw candidate text (resume or LinkedIn)")
    source: str = Field("paste", description="Source type: 'paste' or 'linkedin'")


class AddCandidatesFromTextRequest(BaseModel):
    """Request body for adding candidates from pasted/scraped text."""

    candidates: list[CandidateTextEntry] = Field(
        ..., min_length=1, description="List of candidate text entries"
    )


class AddCandidatesFromTextResponse(BaseModel):
    """Response from adding candidates from text."""

    created: int = Field(description="Number of candidate records created")
