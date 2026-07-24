"""Organization model."""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base, SoftDeleteMixin, TimestampMixin


class Organization(Base, TimestampMixin, SoftDeleteMixin):
    """Organization entity - top-level tenant for multi-tenancy."""

    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    clerk_org_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    plan_id: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'free'")
    )

    # Relationships
    users: Mapped[list["User"]] = relationship(back_populates="organization")  # noqa: F821
    hiring_projects: Mapped[list["HiringProject"]] = relationship(  # noqa: F821
        back_populates="organization"
    )
    subscription: Mapped[Optional["Subscription"]] = relationship(  # noqa: F821
        back_populates="organization"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="organization")  # noqa: F821
    notifications: Mapped[list["Notification"]] = relationship(  # noqa: F821
        back_populates="organization"
    )
    ai_responses: Mapped[list["AIResponse"]] = relationship(  # noqa: F821
        back_populates="organization"
    )
    candidates: Mapped[list["Candidate"]] = relationship(back_populates="organization")  # noqa: F821
    candidate_documents: Mapped[list["CandidateDocument"]] = relationship(  # noqa: F821
        back_populates="organization"
    )
    candidate_communications: Mapped[list["CandidateCommunication"]] = relationship(  # noqa: F821
        back_populates="organization"
    )
