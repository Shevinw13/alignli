"""Tests for the audit logging service.

Validates: Requirements 18.9
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.security.audit import AuditActionType, AuditService


class TestAuditActionType:
    """Tests for the AuditActionType enum."""

    def test_all_required_action_types_exist(self):
        """All security-relevant action types from requirements should be defined."""
        expected_types = [
            "LOGIN",
            "LOGOUT",
            "AUTH_FAILED",
            "DATA_ACCESS",
            "FILE_UPLOAD",
            "CONFIG_CHANGE",
            "USER_INVITED",
            "PROJECT_CREATED",
            "CANDIDATE_HIRED",
            "STATE_TRANSITION",
            "CROSS_ORG_ACCESS",
        ]
        for action_type in expected_types:
            assert hasattr(AuditActionType, action_type)
            assert AuditActionType[action_type].value == action_type

    def test_action_type_is_string_enum(self):
        """Action types should be string enums for DB storage."""
        assert isinstance(AuditActionType.LOGIN.value, str)
        assert AuditActionType.LOGIN == "LOGIN"

    def test_action_type_count(self):
        """Should have exactly the expected number of action types."""
        assert len(AuditActionType) == 11


class TestAuditService:
    """Tests for the AuditService class."""

    @pytest.fixture
    def mock_session(self):
        """Create a mock async database session."""
        session = AsyncMock()
        session.add = MagicMock()
        session.flush = AsyncMock()
        return session

    @pytest.fixture
    def audit_service(self, mock_session):
        """Create an AuditService instance with a mock session."""
        return AuditService(mock_session)

    @pytest.mark.asyncio
    async def test_log_creates_audit_entry(self, audit_service, mock_session):
        """log() should add an AuditLog record to the session."""
        org_id = uuid.uuid4()
        actor_id = uuid.uuid4()
        resource_id = uuid.uuid4()

        result = await audit_service.log(
            action_type=AuditActionType.LOGIN,
            resource_type="session",
            organization_id=org_id,
            actor_id=actor_id,
            resource_id=resource_id,
            ip_address="192.168.1.1",
        )

        # Verify the entry was added to the session
        mock_session.add.assert_called_once()
        added_entry = mock_session.add.call_args[0][0]

        assert added_entry.organization_id == org_id
        assert added_entry.actor_id == actor_id
        assert added_entry.action_type == "LOGIN"
        assert added_entry.resource_type == "session"
        assert added_entry.resource_id == resource_id
        assert added_entry.ip_address == "192.168.1.1"

    @pytest.mark.asyncio
    async def test_log_flushes_session(self, audit_service, mock_session):
        """log() should flush the session to persist the record."""
        org_id = uuid.uuid4()

        await audit_service.log(
            action_type=AuditActionType.LOGOUT,
            resource_type="session",
            organization_id=org_id,
        )

        mock_session.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_log_with_optional_fields_none(self, audit_service, mock_session):
        """log() should work with only required fields."""
        org_id = uuid.uuid4()

        await audit_service.log(
            action_type=AuditActionType.AUTH_FAILED,
            resource_type="session",
            organization_id=org_id,
        )

        added_entry = mock_session.add.call_args[0][0]
        assert added_entry.actor_id is None
        assert added_entry.resource_id is None
        assert added_entry.ip_address is None
        assert added_entry.metadata_ is None

    @pytest.mark.asyncio
    async def test_log_with_metadata(self, audit_service, mock_session):
        """log() should store metadata as JSONB."""
        org_id = uuid.uuid4()
        metadata = {"reason": "invalid_password", "attempts": 3}

        await audit_service.log(
            action_type=AuditActionType.AUTH_FAILED,
            resource_type="session",
            organization_id=org_id,
            metadata=metadata,
        )

        added_entry = mock_session.add.call_args[0][0]
        assert added_entry.metadata_ == metadata

    @pytest.mark.asyncio
    async def test_log_stores_ip_address(self, audit_service, mock_session):
        """log() should store the client IP address."""
        org_id = uuid.uuid4()

        await audit_service.log(
            action_type=AuditActionType.FILE_UPLOAD,
            resource_type="document",
            organization_id=org_id,
            ip_address="10.0.0.1",
        )

        added_entry = mock_session.add.call_args[0][0]
        assert added_entry.ip_address == "10.0.0.1"

    @pytest.mark.asyncio
    async def test_log_returns_audit_entry(self, audit_service, mock_session):
        """log() should return the created AuditLog instance."""
        org_id = uuid.uuid4()

        result = await audit_service.log(
            action_type=AuditActionType.CONFIG_CHANGE,
            resource_type="organization",
            organization_id=org_id,
        )

        # Result should be the same object added to the session
        assert result is mock_session.add.call_args[0][0]

    @pytest.mark.asyncio
    async def test_log_all_action_types(self, mock_session):
        """Each action type should be loggable without error."""
        service = AuditService(mock_session)
        org_id = uuid.uuid4()

        for action_type in AuditActionType:
            await service.log(
                action_type=action_type,
                resource_type="test",
                organization_id=org_id,
            )

        assert mock_session.add.call_count == len(AuditActionType)

    @pytest.mark.asyncio
    async def test_log_cross_org_access(self, audit_service, mock_session):
        """CROSS_ORG_ACCESS should record all required details for security monitoring."""
        org_id = uuid.uuid4()
        actor_id = uuid.uuid4()
        target_resource_id = uuid.uuid4()
        metadata = {
            "target_org_id": str(uuid.uuid4()),
            "request_path": "/api/v1/projects/123",
        }

        await audit_service.log(
            action_type=AuditActionType.CROSS_ORG_ACCESS,
            resource_type="project",
            organization_id=org_id,
            actor_id=actor_id,
            resource_id=target_resource_id,
            ip_address="203.0.113.42",
            metadata=metadata,
        )

        added_entry = mock_session.add.call_args[0][0]
        assert added_entry.action_type == "CROSS_ORG_ACCESS"
        assert added_entry.actor_id == actor_id
        assert added_entry.organization_id == org_id
        assert added_entry.resource_id == target_resource_id
        assert added_entry.ip_address == "203.0.113.42"
        assert added_entry.metadata_["target_org_id"] is not None
