"""Hiring Project model."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base, SoftDeleteMixin, TimestampMixin


class HiringProject(Base, TimestampMixin, SoftDeleteMixin):
    """Hiring Project entity - represents a job position being filled."""

    __tablename__ = "hiring_projects"
    __table_args__ = (
        Index(
            "idx_hiring_projects_org_state",
            "organization_id",
            "state",
            "deleted_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str] = mapped_column(String(100), nullable=False)
    employment_type: Mapped[str] = mapped_column(String(20), nullable=False)
    remote_preference: Mapped[str] = mapped_column(String(20), nullable=False)
    assigned_manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    job_description_raw: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    job_description_extracted: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    state: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'draft'")
    )
    state_history: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    filled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    organization: Mapped["Organization"] = relationship(  # noqa: F821
        back_populates="hiring_projects"
    )
    assigned_manager: Mapped[Optional["User"]] = relationship(  # noqa: F821
        back_populates="managed_projects"
    )
    ranking_criteria: Mapped[list["RankingCriteria"]] = relationship(  # noqa: F821
        back_populates="hiring_project"
    )
    candidates: Mapped[list["Candidate"]] = relationship(  # noqa: F821
        back_populates="hiring_project"
    )
    communications: Mapped[list["CandidateCommunication"]] = relationship(  # noqa: F821
        back_populates="hiring_project"
    )
    ai_responses: Mapped[list["AIResponse"]] = relationship(  # noqa: F821
        back_populates="hiring_project"
    )
