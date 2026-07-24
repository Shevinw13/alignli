"""Pydantic schemas for AI feature endpoints.

Defines request/response models for job description extraction.

Requirements: 4.1, 4.2, 4.3, 4.4
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.core.security.validation import SanitizedBaseModel


# --- Job Description Extraction Schemas ---


class SkillItem(BaseModel):
    """A single skill extracted from a job description."""

    name: str
    description: Optional[str] = None


class EducationItem(BaseModel):
    """An education requirement extracted from a job description."""

    level: Optional[str] = None
    field: Optional[str] = None
    description: Optional[str] = None


class YearsExperience(BaseModel):
    """Years of experience requirements extracted from a job description."""

    minimum: Optional[int] = None
    preferred: Optional[int] = None
    description: Optional[str] = None


class CertificationItem(BaseModel):
    """A certification extracted from a job description."""

    name: str
    required_or_preferred: Optional[str] = None


class LocationRequirements(BaseModel):
    """Location requirements extracted from a job description."""

    location: Optional[str] = None
    remote_policy: Optional[str] = None
    travel_requirements: Optional[str] = None


class ExtractedCategories(BaseModel):
    """Extracted job description data grouped by category."""

    required_skills: list[SkillItem] = Field(default_factory=list)
    preferred_skills: list[SkillItem] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    years_experience: Optional[YearsExperience] = None
    certifications: list[CertificationItem] = Field(default_factory=list)
    location_requirements: Optional[LocationRequirements] = None
    keywords: list[str] = Field(default_factory=list)


class JDExtractionRequest(SanitizedBaseModel):
    """Request schema for job description extraction.

    Either text or file_url must be provided.
    """

    text: Optional[str] = Field(
        None,
        max_length=50000,
        description="Job description text (max 50,000 characters)",
    )
    file_url: Optional[str] = Field(
        None,
        description="URL to a previously uploaded job description file",
    )


class JDExtractionResponse(BaseModel):
    """Response schema for job description extraction.

    Returns extracted data grouped by category for user review.
    """

    categories: ExtractedCategories
    confidence: str = Field(
        description="Confidence level of the extraction: High, Medium, or Low"
    )
