"""Candidate model."""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base, SoftDeleteMixin, TimestampMixin


class Candidate(Base, TimestampMixin, SoftDeleteMixin):
    """Candidate entity - a person being evaluated for a hiring project."""

    __tablename__ = "candidates"
    __table_args__ = (
        CheckConstraint(
            "match_score IS NULL OR (match_score >= 0 AND match_score <= 100)",
            name="ck_match_score_range",
        ),
        Index(
            "idx_candidates_project_score",
            "hiring_project_id",
            text("match_score DESC"),
            "deleted_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    hiring_project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hiring_projects.id"),
        nullable=False,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
    )
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    github_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    current_company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    years_experience: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    match_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    confidence_level: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'pending'")
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'active'")
    )
    parsed_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    strengths: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    concerns: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    interview_questions: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    # Relationships
    hiring_project: Mapped["HiringProject"] = relationship(  # noqa: F821
        back_populates="candidates"
    )
    organization: Mapped["Organization"] = relationship(back_populates="candidates")  # noqa: F821
    scores: Mapped[list["CandidateScore"]] = relationship(  # noqa: F821
        back_populates="candidate"
    )
    documents: Mapped[list["CandidateDocument"]] = relationship(  # noqa: F821
        back_populates="candidate"
    )
    communications: Mapped[list["CandidateCommunication"]] = relationship(  # noqa: F821
        back_populates="candidate"
    )
    interview_notes: Mapped[list["InterviewNote"]] = relationship(  # noqa: F821
        back_populates="candidate"
    )
    ai_responses: Mapped[list["AIResponse"]] = relationship(  # noqa: F821
        back_populates="candidate"
    )
