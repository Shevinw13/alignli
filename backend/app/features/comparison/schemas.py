"""Pydantic schemas for Candidate Comparison API.

Defines request/response models for the comparison endpoint.

Requirements: 12.1, 12.4
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class CompareRequest(BaseModel):
    """Request body for candidate comparison endpoint.

    Accepts 2-4 candidate IDs for side-by-side comparison.
    """

    candidate_ids: list[uuid.UUID] = Field(
        ...,
        min_length=2,
        max_length=4,
        description="List of 2-4 candidate UUIDs to compare",
    )

    @field_validator("candidate_ids")
    @classmethod
    def validate_candidate_count(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        """Ensure exactly 2-4 candidates are provided."""
        if len(v) < 2 or len(v) > 4:
            raise ValueError(
                "Between 2 and 4 candidates must be selected for comparison"
            )
        return v


class CriterionScoreResponse(BaseModel):
    """A single criterion score for a candidate in the comparison."""

    criterion_id: uuid.UUID
    raw_score: int
    normalized_score: float
    reasoning: str

    model_config = {"from_attributes": True}


class ComparisonDimensions(BaseModel):
    """Comparison dimensions extracted from candidate parsed data."""

    experience: Optional[str] = None
    technical_skills: Optional[str] = None
    leadership: Optional[str] = None
    education: Optional[str] = None
    projects: Optional[str] = None
    career_growth: Optional[str] = None
    job_stability: Optional[str] = None
    industry_knowledge: Optional[str] = None
    communication: Optional[str] = None


class ComparedCandidateResponse(BaseModel):
    """Response schema for a single candidate in the comparison view."""

    id: uuid.UUID
    full_name: Optional[str] = None
    match_score: Optional[int] = None
    criterion_scores: list[CriterionScoreResponse] = Field(default_factory=list)
    comparison_dimensions: ComparisonDimensions

    model_config = {"from_attributes": True}


class CompareResponse(BaseModel):
    """Response schema for the candidate comparison endpoint."""

    candidates: list[ComparedCandidateResponse]
