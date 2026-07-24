"""Candidate Score model."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base, TimestampMixin


class CandidateScore(Base, TimestampMixin):
    """Candidate Score entity - individual criterion score for a candidate."""

    __tablename__ = "candidate_scores"
    __table_args__ = (
        UniqueConstraint("candidate_id", "ranking_criteria_id", name="uq_candidate_criteria"),
        CheckConstraint(
            "raw_score >= 0 AND raw_score <= 100",
            name="ck_raw_score_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id"),
        nullable=False,
    )
    ranking_criteria_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ranking_criteria.id"),
        nullable=False,
    )
    raw_score: Mapped[int] = mapped_column(Integer, nullable=False)
    normalized_score: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False)
    weighted_score: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False)
    reasoning: Mapped[str] = mapped_column(String(500), nullable=False)

    # Relationships
    candidate: Mapped["Candidate"] = relationship(back_populates="scores")  # noqa: F821
    ranking_criteria: Mapped["RankingCriteria"] = relationship(  # noqa: F821
        back_populates="candidate_scores"
    )
