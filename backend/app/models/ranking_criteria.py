"""Ranking Criteria model."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base, SoftDeleteMixin, TimestampMixin


class RankingCriteria(Base, TimestampMixin, SoftDeleteMixin):
    """Ranking Criteria entity - defines scoring dimensions for a hiring project."""

    __tablename__ = "ranking_criteria"
    __table_args__ = (
        CheckConstraint("max_score >= 1 AND max_score <= 100", name="ck_max_score_range"),
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
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    priority: Mapped[str] = mapped_column(String(10), nullable=False)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False)
    weight: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    hiring_project: Mapped["HiringProject"] = relationship(  # noqa: F821
        back_populates="ranking_criteria"
    )
    candidate_scores: Mapped[list["CandidateScore"]] = relationship(  # noqa: F821
        back_populates="ranking_criteria"
    )
