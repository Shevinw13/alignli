"""Interview Note model."""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base, SoftDeleteMixin, TimestampMixin


class InterviewNote(Base, TimestampMixin, SoftDeleteMixin):
    """Interview Note entity - notes written by a user about a candidate."""

    __tablename__ = "interview_notes"
    __table_args__ = (
        CheckConstraint(
            "length(content) <= 5000",
            name="ck_content_length",
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
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    candidate: Mapped["Candidate"] = relationship(  # noqa: F821
        back_populates="interview_notes"
    )
    author: Mapped["User"] = relationship(back_populates="interview_notes")  # noqa: F821
