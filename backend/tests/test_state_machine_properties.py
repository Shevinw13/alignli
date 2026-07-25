"""Property-based tests for Hiring Project state machine.

These tests verify universal state machine properties under randomized inputs:
- Property 7: Hiring Project State Machine Validity
- Property 8: State Transition Prerequisites Enforcement
- Property 9: State Transition History Recording

**Validates: Requirements 21.2, 21.3, 21.6, 21.7**
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st

from app.core.security.exceptions import (
    ConflictException,
    UnprocessableException,
)
from app.features.hiring_projects.state_machine import (
    ProjectState,
    VALID_TRANSITIONS,
    get_valid_transitions,
    transition_state,
)


# --- Strategies ---

# All valid project states
all_states = list(ProjectState.ALL)
all_states_strategy = st.sampled_from(all_states)

# States that are not in the valid set (invalid target states)
invalid_state_names = st.text(
    alphabet=st.characters(whitelist_categories=("L",)),
    min_size=1,
    max_size=30,
).filter(lambda s: s not in ProjectState.ALL)

# Authorized roles
authorized_roles_strategy = st.sampled_from(["Hiring_Manager", "Admin", "Owner"])

# Actor user ID
actor_id_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N")),
    min_size=1,
    max_size=50,
)

# Prior state history entries (0–5 existing entries)
history_entry_strategy = st.fixed_dictionaries({
    "previous_state": all_states_strategy,
    "new_state": all_states_strategy,
    "actor_id": actor_id_strategy,
    "timestamp": st.just("2024-01-10T10:00:00+00:00"),
})

prior_history_strategy = st.lists(history_entry_strategy, min_size=0, max_size=5)


# --- Property 7: Hiring Project State Machine Validity ---


class TestStateMachineValidity:
    """Property 7: Hiring Project State Machine Validity.

    *For any* Hiring Project in state S, the system SHALL allow only the
    transitions defined in the valid transition graph, and SHALL reject all
    other transitions with an error listing valid transitions from S.

    **Validates: Requirements 21.2, 21.6**
    """

    @given(
        current_state=all_states_strategy,
        target_state=all_states_strategy,
    )
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_invalid_transitions_are_rejected_with_valid_list(
        self, current_state: str, target_state: str
    ):
        """Undefined transitions are rejected with a ConflictException listing valid targets."""
        valid_targets = VALID_TRANSITIONS.get(current_state, set())

        # Only test invalid transitions
        if target_state in valid_targets:
            return  # Skip — this is a valid transition, tested elsewhere

        # Set up mocks
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = current_state
        mock_project.state_history = []

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            with pytest.raises(ConflictException) as exc_info:
                import asyncio
                asyncio.get_event_loop().run_until_complete(
                    transition_state(
                        session=session,
                        project_id=project_id,
                        new_state=target_state,
                        actor_user_id="user-test",
                        actor_role="Admin",
                    )
                )

            # The error message must reference valid transitions from current state
            expected_valid = get_valid_transitions(current_state)
            error_msg = exc_info.value.message
            assert "Invalid state transition" in error_msg
            # Details must include valid transitions list
            assert exc_info.value.details is not None
            valid_trans_detail = next(
                (d for d in exc_info.value.details if d["field"] == "valid_transitions"),
                None,
            )
            assert valid_trans_detail is not None
            # Verify all valid transitions are mentioned in the detail message
            for valid_target in expected_valid:
                assert valid_target in valid_trans_detail["message"]

    @given(
        current_state=all_states_strategy,
        invalid_target=invalid_state_names,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_nonexistent_target_states_are_rejected(
        self, current_state: str, invalid_target: str
    ):
        """Transitions to states not in the defined state set are always rejected."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = current_state
        mock_project.state_history = []

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            with pytest.raises(ConflictException):
                import asyncio
                asyncio.get_event_loop().run_until_complete(
                    transition_state(
                        session=session,
                        project_id=project_id,
                        new_state=invalid_target,
                        actor_user_id="user-test",
                        actor_role="Owner",
                    )
                )

    @given(current_state=all_states_strategy)
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_get_valid_transitions_matches_transition_graph(self, current_state: str):
        """get_valid_transitions returns exactly the targets from VALID_TRANSITIONS."""
        result = get_valid_transitions(current_state)
        expected = sorted(VALID_TRANSITIONS.get(current_state, set()))
        assert result == expected


# --- Property 8: State Transition Prerequisites Enforcement ---


class TestPrerequisitesEnforcement:
    """Property 8: State Transition Prerequisites Enforcement.

    *For any* state transition attempt, the system SHALL verify that the
    defined prerequisites are met, and SHALL reject the transition if
    prerequisites are not satisfied.

    **Validates: Requirements 21.3**
    """

    # Map transitions that have prerequisites to their required candidate status/conditions
    TRANSITIONS_WITH_PREREQUISITES = [
        (ProjectState.DRAFT, ProjectState.ACTIVE, "completed"),
        (ProjectState.ACTIVE, ProjectState.REVIEWING, None),  # just needs candidates
        (ProjectState.REVIEWING, ProjectState.INTERVIEWING, "interview"),
        (ProjectState.INTERVIEWING, ProjectState.OFFER_EXTENDED, "offer"),
        (ProjectState.OFFER_EXTENDED, ProjectState.FILLED, "accepted"),
    ]

    @given(
        transition_idx=st.integers(min_value=0, max_value=4),
        actor_role=authorized_roles_strategy,
        actor_id=actor_id_strategy,
    )
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_prerequisites_block_transition_when_not_met(
        self, transition_idx: int, actor_role: str, actor_id: str
    ):
        """Transitions with unmet prerequisites raise UnprocessableException."""
        from_state, to_state, _ = self.TRANSITIONS_WITH_PREREQUISITES[transition_idx]

        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = from_state
        mock_project.state_history = []

        # Mock the prerequisite check to return 0 candidates (prerequisite NOT met)
        mock_result = MagicMock()
        mock_result.scalar.return_value = 0
        session.execute = AsyncMock(return_value=mock_result)

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            with pytest.raises(UnprocessableException) as exc_info:
                import asyncio
                asyncio.get_event_loop().run_until_complete(
                    transition_state(
                        session=session,
                        project_id=project_id,
                        new_state=to_state,
                        actor_user_id=actor_id,
                        actor_role=actor_role,
                    )
                )

            assert "Prerequisites not met" in exc_info.value.message
            assert exc_info.value.details is not None
            assert len(exc_info.value.details) > 0

    @given(
        transition_idx=st.integers(min_value=0, max_value=4),
        candidate_count=st.integers(min_value=1, max_value=100),
        actor_role=authorized_roles_strategy,
        actor_id=actor_id_strategy,
    )
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_prerequisites_allow_transition_when_met(
        self, transition_idx: int, candidate_count: int, actor_role: str, actor_id: str
    ):
        """Transitions succeed when prerequisites are met (≥1 qualifying candidate)."""
        from_state, to_state, _ = self.TRANSITIONS_WITH_PREREQUISITES[transition_idx]

        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = from_state
        mock_project.state_history = []

        # Mock the prerequisite check to pass with candidate_count >= 1
        mock_result = MagicMock()
        mock_result.scalar.return_value = candidate_count
        session.execute = AsyncMock(return_value=mock_result)
        session.flush = AsyncMock()
        session.refresh = AsyncMock()

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            import asyncio
            result = asyncio.get_event_loop().run_until_complete(
                transition_state(
                    session=session,
                    project_id=project_id,
                    new_state=to_state,
                    actor_user_id=actor_id,
                    actor_role=actor_role,
                )
            )

            # Transition must have succeeded — state updated
            assert result.state == to_state

    @given(
        current_state=st.sampled_from([
            s for s in all_states if s != ProjectState.ARCHIVED
        ]),
        actor_role=authorized_roles_strategy,
        actor_id=actor_id_strategy,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_archive_transition_has_no_prerequisites(
        self, current_state: str, actor_role: str, actor_id: str
    ):
        """Archiving from any state requires no prerequisites and always succeeds."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = current_state
        mock_project.state_history = []

        session.flush = AsyncMock()
        session.refresh = AsyncMock()

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            import asyncio
            result = asyncio.get_event_loop().run_until_complete(
                transition_state(
                    session=session,
                    project_id=project_id,
                    new_state=ProjectState.ARCHIVED,
                    actor_user_id=actor_id,
                    actor_role=actor_role,
                )
            )

            assert result.state == ProjectState.ARCHIVED


# --- Property 9: State Transition History Recording ---


class TestStateTransitionHistoryRecording:
    """Property 9: State Transition History Recording.

    *For any* successful state transition, the system SHALL append an entry
    to the project's state history containing the previous state, new state,
    actor user ID, and timestamp, such that the history length increases by
    exactly one.

    **Validates: Requirements 21.7**
    """

    @given(
        current_state=st.sampled_from([
            s for s in all_states if s != ProjectState.ARCHIVED
        ]),
        prior_history=prior_history_strategy,
        actor_id=actor_id_strategy,
        actor_role=authorized_roles_strategy,
    )
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_transition_appends_exactly_one_history_entry(
        self, current_state: str, prior_history: list, actor_id: str, actor_role: str
    ):
        """Each successful transition increases history length by exactly one."""
        # Use Archived as target — no prerequisites needed
        target_state = ProjectState.ARCHIVED

        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = current_state
        mock_project.state_history = list(prior_history)  # copy to avoid mutation

        session.flush = AsyncMock()
        session.refresh = AsyncMock()

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            import asyncio
            result = asyncio.get_event_loop().run_until_complete(
                transition_state(
                    session=session,
                    project_id=project_id,
                    new_state=target_state,
                    actor_user_id=actor_id,
                    actor_role=actor_role,
                )
            )

            # History must have grown by exactly 1
            assert len(result.state_history) == len(prior_history) + 1

    @given(
        current_state=st.sampled_from([
            s for s in all_states if s != ProjectState.ARCHIVED
        ]),
        prior_history=prior_history_strategy,
        actor_id=actor_id_strategy,
        actor_role=authorized_roles_strategy,
    )
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_history_entry_contains_required_fields(
        self, current_state: str, prior_history: list, actor_id: str, actor_role: str
    ):
        """New history entry has previous_state, new_state, actor_id, and timestamp."""
        target_state = ProjectState.ARCHIVED

        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = current_state
        mock_project.state_history = list(prior_history)

        session.flush = AsyncMock()
        session.refresh = AsyncMock()

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            import asyncio
            result = asyncio.get_event_loop().run_until_complete(
                transition_state(
                    session=session,
                    project_id=project_id,
                    new_state=target_state,
                    actor_user_id=actor_id,
                    actor_role=actor_role,
                )
            )

            # Get the newly appended entry
            new_entry = result.state_history[-1]

            # Must contain all required fields
            assert new_entry["previous_state"] == current_state
            assert new_entry["new_state"] == target_state
            assert new_entry["actor_id"] == actor_id
            assert "timestamp" in new_entry
            # Timestamp must be a valid ISO format string
            datetime.fromisoformat(new_entry["timestamp"])

    @given(
        current_state=st.sampled_from([
            s for s in all_states if s != ProjectState.ARCHIVED
        ]),
        prior_history=prior_history_strategy,
        actor_id=actor_id_strategy,
        actor_role=authorized_roles_strategy,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_prior_history_entries_are_preserved(
        self, current_state: str, prior_history: list, actor_id: str, actor_role: str
    ):
        """Existing history entries are not modified when a new entry is appended."""
        target_state = ProjectState.ARCHIVED

        session = AsyncMock()
        project_id = uuid.uuid4()

        # Deep copy prior history
        original_history = [dict(entry) for entry in prior_history]

        mock_project = MagicMock()
        mock_project.state = current_state
        mock_project.state_history = list(prior_history)

        session.flush = AsyncMock()
        session.refresh = AsyncMock()

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            import asyncio
            result = asyncio.get_event_loop().run_until_complete(
                transition_state(
                    session=session,
                    project_id=project_id,
                    new_state=target_state,
                    actor_user_id=actor_id,
                    actor_role=actor_role,
                )
            )

            # All prior entries must be unchanged
            for i, original_entry in enumerate(original_history):
                assert result.state_history[i] == original_entry
