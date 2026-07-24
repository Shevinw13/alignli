"""Pydantic schemas for Hiring Project API.

Defines request/response models for project creation, listing, and detail endpoints.

Requirements: 3.1, 3.2, 3.4, 3.5, 3.6
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.core.security.validation import SanitizedBaseModel


class EmploymentType(str, Enum):
    """Valid employment type options."""

    FULL_TIME = "Full-time"
    PART_TIME = "Part-time"
    CONTRACT = "Contract"
    TEMPORARY = "Temporary"


class RemotePreference(str, Enum):
    """Valid remote preference options."""

    REMOTE = "Remote"
    HYBRID = "Hybrid"
    ON_SITE = "On-site"


class ProjectCreateRequest(SanitizedBaseModel):
    """Request schema for creating a new hiring project.

    All fields are required. Inputs are automatically sanitized
    (HTML stripped, whitespace trimmed) by SanitizedBaseModel.
    """

    title: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Project title (max 100 characters)",
    )
    location: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Job location (max 100 characters)",
    )
    employment_type: EmploymentType = Field(
        ...,
        description="Employment type: Full-time, Part-time, Contract, or Temporary",
    )
    remote_preference: RemotePreference = Field(
        ...,
        description="Remote preference: Remote, Hybrid, or On-site",
    )
    assigned_manager_id: uuid.UUID = Field(
        ...,
        description="UUID of the assigned hiring manager",
    )


class ProjectResponse(BaseModel):
    """Response schema for a single hiring project."""

    id: uuid.UUID
    organization_id: uuid.UUID
    title: str
    location: str
    employment_type: str
    remote_preference: str
    assigned_manager_id: uuid.UUID
    state: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    """Response schema for paginated project list."""

    items: list[ProjectResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class StateTransitionRequest(SanitizedBaseModel):
    """Request schema for transitioning project state.

    Requirements: 21.1, 21.2
    """

    state: str = Field(
        ...,
        min_length=1,
        max_length=30,
        description="Target state to transition to",
    )
