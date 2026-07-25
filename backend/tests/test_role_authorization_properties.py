"""Property-based tests for role-based state transition authorization.

Property 10: Role-Based State Transition Authorization
- For any user with role Hiring_Manager, Admin, or Owner, the system SHALL permit
  state transitions on projects they have access to.
- For any user with role Recruiter or Viewer, the system SHALL deny state transition attempts.

**Validates: Requirements 21.5, 16.5**
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from app.core.security.exceptions import ForbiddenException
from app.features.hiring_projects.state_machine import (
    TRANSITION_AUTHORIZED_ROLES,
    ProjectState,
    VALID_TRANSITIONS,
    transition_state,
)


# --- Strategies ---

# Authorized roles that can perform state transitions
authorized_role_strategy = st.sampled_from(sorted(TRANSITION_AUTHORIZED_ROLES))

# Unauthorized roles that cannot perform state transitions
unauthorized_role_strategy = st.sampled_from(["Recruiter", "Viewer"])

# All defined roles in the system (Requirement 16.5)
all_roles_strategy = st.sampled_from(["Owner", "Admin", "Hiring_Manager", "Recruiter", "Viewer"])

# Non-terminal states (states that have at least one valid forward transition)
non_terminal_states = [s for s in ProjectState.ALL if VALID_TRANSITIONS.get(s)]
non_terminal_state_strategy = st.sampled_from(sorted(non_terminal_states))

# Any valid project state
any_state_strategy = st.sampled_from(sorted(ProjectState.ALL))

# Generate user IDs
user_id_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="_-"),
    min_size=3,
    max_size=50,
).filter(lambda s: len(s.strip()) >= 3)

# None role (e.g., unauthenticated or role not set)
none_role_strategy = st.none()

# Strategy for roles that should be denied: Recruiter, Viewer, None, or unknown strings
denied_role_strategy = st.one_of(
    unauthorized_role_strategy,
    none_role_strategy,
    st.text(
        alphabet=st.characters(whitelist_categories=("L",)),
        min_size=1,
        max_size=20,
    ).filter(lambda r: r not in TRANSITION_AUTHORIZED_ROLES),
)


# --- Helpers ---


def _get_valid_target_for_state(state: str) -> str:
    """Get a valid target state for the given source state."""
    targets = VALID_TRANSITIONS.get(state, set())
    if targets:
        return sorted(targets)[0]
    # Shouldn't happen for non-terminal states
    raise ValueError(f"No valid targets for state: {state}")


# --- Property 10: Role-Based State Transition Authorization ---


class TestRoleBasedStateTransitionAuthorization:
    """Property 10: Role-Based State Transition Authorization.

    For any user with role Hiring_Manager, Admin, or Owner, the system SHALL
    permit state transitions on projects they have access to. For any user with
    role Recruiter or Viewer, the system SHALL deny state transition attempts.

    **Validates: Requirements 21.5, 16.5**
    """

    @given(
        role=authorized_role_strategy,
        current_state=non_terminal_state_strategy,
        user_id=user_id_strategy,
    )
    @settings(max_examples=150)
    @pytest.mark.asyncio
    async def test_authorized_roles_can_transition(
        self,
        role: str,
        current_state: str,
        user_id: str,
    ):
        """Authorized roles (Hiring_Manager, Admin, Owner) are not rejected at
        the authorization step.

        The transition may still fail for other reasons (invalid transition,
        prerequisites not met), but the role check itself must pass.

        **Validates: Requirements 21.5, 16.5**
        """
        session = AsyncMock()
        project_id = uuid.uuid4()

        target_state = _get_valid_target_for_state(current_state)

        mock_project = MagicMock()
        mock_project.state = current_state
        mock_project.state_history = []
        mock_project.filled_at = None

        # Mock prerequisite check to pass (return count of 1)
        mock_result = MagicMock()
        mock_result.scalar.return_value = 1
        session.execute = AsyncMock(return_value=mock_result)
        session.flush = AsyncMock()
        session.refresh = AsyncMock()

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            # Should NOT raise ForbiddenException for authorized roles
            result = await transition_state(
                session=session,
                project_id=project_id,
                new_state=target_state,
                actor_user_id=user_id,
                actor_role=role,
            )

            # Transition succeeded — state was updated
            assert result.state == target_state

    @given(
        role=denied_role_strategy,
        current_state=non_terminal_state_strategy,
        user_id=user_id_strategy,
    )
    @settings(max_examples=200)
    @pytest.mark.asyncio
    async def test_unauthorized_roles_are_denied(
        self,
        role: str | None,
        current_state: str,
        user_id: str,
    ):
        """Unauthorized roles (Recruiter, Viewer, None, unknown) are denied
        state transitions with a ForbiddenException.

        The denial must happen before any project lookup or state validation,
        ensuring unauthorized users cannot even probe the state machine.

        **Validates: Requirements 21.5, 16.5**
        """
        session = AsyncMock()
        project_id = uuid.uuid4()

        target_state = _get_valid_target_for_state(current_state)

        with pytest.raises(ForbiddenException) as exc_info:
            await transition_state(
                session=session,
                project_id=project_id,
                new_state=target_state,
                actor_user_id=user_id,
                actor_role=role,
            )

        # Verify the error message mentions the required roles
        assert "Hiring_Manager" in exc_info.value.message or "Admin" in exc_info.value.message or "Owner" in exc_info.value.message

    @given(
        role=denied_role_strategy,
        current_state=any_state_strategy,
        user_id=user_id_strategy,
    )
    @settings(max_examples=100)
    @pytest.mark.asyncio
    async def test_unauthorized_roles_denied_regardless_of_target_state(
        self,
        role: str | None,
        current_state: str,
        user_id: str,
    ):
        """Unauthorized roles are denied for ANY target state, including Archive.

        Even if archiving is universally valid from any state, the role check
        must still reject unauthorized users.

        **Validates: Requirements 21.5, 16.5**
        """
        session = AsyncMock()
        project_id = uuid.uuid4()

        # Try to archive (valid from any non-Archived state)
        target_state = ProjectState.ARCHIVED

        with pytest.raises(ForbiddenException):
            await transition_state(
                session=session,
                project_id=project_id,
                new_state=target_state,
                actor_user_id=user_id,
                actor_role=role,
            )

    @given(
        role=denied_role_strategy,
        user_id=user_id_strategy,
    )
    @settings(max_examples=50)
    @pytest.mark.asyncio
    async def test_unauthorized_role_denial_occurs_before_project_lookup(
        self,
        role: str | None,
        user_id: str,
    ):
        """The role check is the first validation step — it happens before
        looking up the project from the database.

        This ensures no database state is leaked to unauthorized users.

        **Validates: Requirements 21.5, 16.5**
        """
        session = AsyncMock()
        project_id = uuid.uuid4()

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=None)

            with pytest.raises(ForbiddenException):
                await transition_state(
                    session=session,
                    project_id=project_id,
                    new_state="Active",
                    actor_user_id=user_id,
                    actor_role=role,
                )

            # The repository should never have been called
            mock_repo.get.assert_not_called()

    @given(
        role=authorized_role_strategy,
        user_id=user_id_strategy,
    )
    @settings(max_examples=50)
    @pytest.mark.asyncio
    async def test_authorized_role_proceeds_to_project_lookup(
        self,
        role: str,
        user_id: str,
    ):
        """Authorized roles pass the role check and proceed to project lookup.

        This verifies that the role check does NOT block valid roles.

        **Validates: Requirements 21.5, 16.5**
        """
        session = AsyncMock()
        project_id = uuid.uuid4()

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            # Project not found — but the key assertion is that we GET to the lookup
            mock_repo.get = AsyncMock(return_value=None)

            from app.core.security.exceptions import NotFoundException

            with pytest.raises(NotFoundException):
                await transition_state(
                    session=session,
                    project_id=project_id,
                    new_state="Active",
                    actor_user_id=user_id,
                    actor_role=role,
                )

            # The repository WAS called — role check passed
            mock_repo.get.assert_called_once_with(project_id)
