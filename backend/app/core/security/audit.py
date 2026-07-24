"""Audit logging service for security-relevant actions.

Records security-relevant actions including login, logout, failed authentication
attempts, data access, file uploads, and configuration changes.

Each entry stores: timestamp (auto via DB), actor identity, action type,
affected resource, IP address, and optional metadata.

Requirements: 18.9
"""

from __future__ import annotations

import logging
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_logs import AuditLog

logger = logging.getLogger(__name__)


class AuditActionType(str, Enum):
    """Security-relevant action types tracked by the audit system."""

    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    AUTH_FAILED = "AUTH_FAILED"
    DATA_ACCESS = "DATA_ACCESS"
    FILE_UPLOAD = "FILE_UPLOAD"
    CONFIG_CHANGE = "CONFIG_CHANGE"
    USER_INVITED = "USER_INVITED"
    PROJECT_CREATED = "PROJECT_CREATED"
    CANDIDATE_HIRED = "CANDIDATE_HIRED"
    STATE_TRANSITION = "STATE_TRANSITION"
    CROSS_ORG_ACCESS = "CROSS_ORG_ACCESS"


class AuditService:
    """Service for recording security-relevant audit log entries.

    Can be called from middleware, route handlers, or background jobs.
    All operations are async and non-blocking to the caller's primary workflow.

    Usage:
        audit = AuditService(db_session)
        await audit.log(
            action_type=AuditActionType.LOGIN,
            resource_type="session",
            organization_id=org_id,
            actor_id=user_id,
            ip_address="192.168.1.1",
        )
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def log(
        self,
        *,
        action_type: AuditActionType,
        resource_type: str,
        organization_id: UUID,
        actor_id: Optional[UUID] = None,
        resource_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> AuditLog:
        """Record a security-relevant action in the audit log.

        Args:
            action_type: The type of action being recorded.
            resource_type: The type of resource affected (e.g., "session", "project", "file").
            organization_id: The organization context for the action.
            actor_id: The user who performed the action (None for system actions).
            resource_id: The specific resource affected, if applicable.
            ip_address: The IP address of the request origin.
            metadata: Additional context about the action (stored as JSONB).

        Returns:
            The created AuditLog record.
        """
        audit_entry = AuditLog(
            organization_id=organization_id,
            actor_id=actor_id,
            action_type=action_type.value,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_=metadata,
            ip_address=ip_address,
        )

        self.session.add(audit_entry)
        await self.session.flush()

        logger.info(
            "Audit: %s on %s/%s by actor=%s org=%s",
            action_type.value,
            resource_type,
            resource_id,
            actor_id,
            organization_id,
        )

        return audit_entry


async def get_audit_service(session: AsyncSession) -> AuditService:
    """Create an AuditService instance.

    This is designed to be composed with the get_db dependency in route handlers:

        @router.post("/example")
        async def example(
            db: AsyncSession = Depends(get_db),
        ):
            audit = AuditService(db)
            await audit.log(...)
    """
    return AuditService(session)
