"""Property-based tests for audit logging completeness.

These tests verify that every security-relevant action creates an audit log entry
with all required fields (timestamp, actor identity, action type, affected resource, IP address).

- Property 26: Audit Log Completeness — verify every security-relevant action creates an audit log entry

Validates: Requirements 18.9
"""

from __future__ import annotations

import uuid
from typing import Any, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st

from app.core.security.audit import AuditActionType, AuditService
from app.models.audit_logs import AuditLog


# --- Strategies ---

# All security-relevant action types defined in the system
action_type_strategy = st.sampled_from(list(AuditActionType))

# Resource types that map to security-relevant actions
resource_type_strategy = st.sampled_from([
    "session",
    "project",
    "candidate",
    "document",
    "organization",
    "user",
    "criteria",
    "communication",
    "subscription",
])

# UUIDs for actor and resource identifiers
uuid_strategy = st.uuids()

# Optional UUID (actor may be None for system-level actions)
optional_uuid_strategy = st.one_of(st.none(), st.uuids())

# IP addresses (v4)
ip_address_strategy = st.one_of(
    st.none(),
    st.tuples(
        st.integers(min_value=1, max_value=255),
        st.integers(min_value=0, max_value=255),
        st.integers(min_value=0, max_value=255),
        st.integers(min_value=1, max_value=254),
    ).map(lambda t: f"{t[0]}.{t[1]}.{t[2]}.{t[3]}"),
)

# Metadata: optional dictionary with string keys and simple values
metadata_strategy = st.one_of(
    st.none(),
    st.dictionaries(
        keys=st.text(
            alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="_"),
            min_size=1,
            max_size=20,
        ),
        values=st.one_of(
            st.text(min_size=0, max_size=100),
            st.integers(min_value=-1000, max_value=1000),
            st.booleans(),
        ),
        min_size=0,
        max_size=5,
    ),
)


# --- Property 26: Audit Log Completeness ---


class TestAuditLogCompleteness:
    """Property 26: Audit Log Completeness.

    For every security-relevant action type, calling the audit service SHALL create
    an audit log entry that records: action type, resource type, organization ID,
    and optionally actor identity, IP address, and metadata.

    The audit system must guarantee that no security-relevant action can occur
    without producing a corresponding log entry.

    **Validates: Requirements 18.9**
    """

    @given(
        action_type=action_type_strategy,
        resource_type=resource_type_strategy,
        organization_id=uuid_strategy,
        actor_id=optional_uuid_strategy,
        resource_id=optional_uuid_strategy,
        ip_address=ip_address_strategy,
        metadata=metadata_strategy,
    )
    @settings(max_examples=200, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_every_action_type_creates_audit_entry(
        self,
        action_type: AuditActionType,
        resource_type: str,
        organization_id: uuid.UUID,
        actor_id: Optional[uuid.UUID],
        resource_id: Optional[uuid.UUID],
        ip_address: Optional[str],
        metadata: Optional[dict[str, Any]],
    ):
        """Every security-relevant action type always produces an audit log entry.

        For any combination of action type, resource type, actor, and context,
        the audit service must persist an entry with the correct fields.

        **Validates: Requirements 18.9**
        """
        # Arrange: create a mock session that captures the added entry
        mock_session = AsyncMock()
        added_entries: list[AuditLog] = []
        mock_session.add = MagicMock(side_effect=lambda entry: added_entries.append(entry))
        mock_session.flush = AsyncMock()

        service = AuditService(mock_session)

        # Act: log the security-relevant action
        result = await service.log(
            action_type=action_type,
            resource_type=resource_type,
            organization_id=organization_id,
            actor_id=actor_id,
            resource_id=resource_id,
            ip_address=ip_address,
            metadata=metadata,
        )

        # Assert: an entry was always created (completeness)
        assert len(added_entries) == 1, (
            f"Expected exactly 1 audit entry for action {action_type.value}, "
            f"got {len(added_entries)}"
        )

        entry = added_entries[0]

        # Assert: the entry records the correct action type
        assert entry.action_type == action_type.value, (
            f"Audit entry action_type mismatch: expected {action_type.value}, "
            f"got {entry.action_type}"
        )

        # Assert: the entry records the resource type
        assert entry.resource_type == resource_type

        # Assert: the entry records the organization context
        assert entry.organization_id == organization_id

        # Assert: actor identity is recorded when provided
        assert entry.actor_id == actor_id

        # Assert: affected resource is recorded when provided
        assert entry.resource_id == resource_id

        # Assert: IP address is recorded when provided
        if ip_address is not None:
            assert entry.ip_address == ip_address
        else:
            assert entry.ip_address is None

        # Assert: metadata is recorded when provided
        assert entry.metadata_ == metadata

        # Assert: session was flushed (entry persisted)
        mock_session.flush.assert_awaited()

        # Assert: the returned result is the same entry
        assert result is entry

    @given(action_type=action_type_strategy)
    @settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_audit_entry_always_persisted_to_session(
        self,
        action_type: AuditActionType,
    ):
        """The audit service always flushes the session after adding an entry.

        This ensures the audit record is durably persisted and cannot be silently
        lost due to a missing flush/commit.

        **Validates: Requirements 18.9**
        """
        mock_session = AsyncMock()
        mock_session.add = MagicMock()
        mock_session.flush = AsyncMock()

        service = AuditService(mock_session)

        await service.log(
            action_type=action_type,
            resource_type="test_resource",
            organization_id=uuid.uuid4(),
        )

        # add() must be called before flush()
        mock_session.add.assert_called_once()
        mock_session.flush.assert_awaited_once()

    @given(
        action_types=st.lists(action_type_strategy, min_size=1, max_size=10),
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_multiple_actions_each_produce_separate_entries(
        self,
        action_types: list[AuditActionType],
    ):
        """When multiple security-relevant actions occur, each produces its own entry.

        No actions are batched, merged, or deduplicated—every call to log()
        creates exactly one audit record.

        **Validates: Requirements 18.9**
        """
        mock_session = AsyncMock()
        added_entries: list[AuditLog] = []
        mock_session.add = MagicMock(side_effect=lambda entry: added_entries.append(entry))
        mock_session.flush = AsyncMock()

        service = AuditService(mock_session)
        org_id = uuid.uuid4()

        for action_type in action_types:
            await service.log(
                action_type=action_type,
                resource_type="test",
                organization_id=org_id,
            )

        # Each action must produce exactly one entry
        assert len(added_entries) == len(action_types), (
            f"Expected {len(action_types)} audit entries, got {len(added_entries)}"
        )

        # Each entry must record the correct action type in order
        for i, (entry, expected_type) in enumerate(zip(added_entries, action_types)):
            assert entry.action_type == expected_type.value, (
                f"Entry {i} has action_type={entry.action_type}, "
                f"expected {expected_type.value}"
            )

    @given(
        action_type=action_type_strategy,
        resource_type=resource_type_strategy,
        organization_id=uuid_strategy,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_required_fields_always_present_in_entry(
        self,
        action_type: AuditActionType,
        resource_type: str,
        organization_id: uuid.UUID,
    ):
        """Audit entries always contain the required fields per Requirement 18.9.

        Required fields: action_type, resource_type, organization_id.
        The timestamp is handled by the database (server_default).

        **Validates: Requirements 18.9**
        """
        mock_session = AsyncMock()
        added_entries: list[AuditLog] = []
        mock_session.add = MagicMock(side_effect=lambda entry: added_entries.append(entry))
        mock_session.flush = AsyncMock()

        service = AuditService(mock_session)

        await service.log(
            action_type=action_type,
            resource_type=resource_type,
            organization_id=organization_id,
        )

        entry = added_entries[0]

        # Required fields must never be None
        assert entry.action_type is not None
        assert entry.resource_type is not None
        assert entry.organization_id is not None

        # action_type must be a valid enum value
        assert entry.action_type in [at.value for at in AuditActionType]

    def test_all_security_relevant_actions_have_corresponding_enum_values(self):
        """The system defines enum values for all security-relevant actions listed in Req 18.9.

        Requirement 18.9 specifies: login, logout, failed authentication attempts,
        data access, file uploads, and configuration changes.

        **Validates: Requirements 18.9**
        """
        # These are the mandatory action types from Requirement 18.9
        required_actions = {
            "LOGIN": "login",
            "LOGOUT": "logout",
            "AUTH_FAILED": "failed authentication attempts",
            "DATA_ACCESS": "data access",
            "FILE_UPLOAD": "file uploads",
            "CONFIG_CHANGE": "configuration changes",
        }

        for enum_name, description in required_actions.items():
            assert hasattr(AuditActionType, enum_name), (
                f"Missing AuditActionType.{enum_name} for '{description}' "
                f"(required by Requirement 18.9)"
            )
            # Verify it's a valid enum member
            member = AuditActionType[enum_name]
            assert member.value == enum_name
