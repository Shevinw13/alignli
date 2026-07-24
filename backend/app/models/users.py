"""User model."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base, SoftDeleteMixin, TimestampMixin


class User(Base, TimestampMixin, SoftDeleteMixin):
    """User entity - belongs to an organization with a specific role."""

    __tablename__ = "users"

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
    clerk_user_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="users")  # noqa: F821
    managed_projects: Mapped[list["HiringProject"]] = relationship(  # noqa: F821
        back_populates="assigned_manager"
    )
    interview_notes: Mapped[list["InterviewNote"]] = relationship(  # noqa: F821
        back_populates="author"
    )
    sent_communications: Mapped[list["CandidateCommunication"]] = relationship(  # noqa: F821
        back_populates="sender"
    )
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")  # noqa: F821
