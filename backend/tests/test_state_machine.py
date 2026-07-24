"""Unit tests for the project state machine.

Tests cover:
- Valid transition definitions
- Invalid transition rejection (409 Conflict)
- Role-based authorization (403 Forbidden)
- Prerequisite validation (422 Unprocessable)
- State history recording
- Helper functions

Requirements: 21.1, 21.2, 21.3, 21.5, 21.6, 21.7
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.security.exceptions import (
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnprocessableException,
)
from app.features.hiring_projects.state_machine import (
    ProjectState,
    VALID_TRANSITIONS,
    TRANSITION_AUTHORIZED_ROLES,
    get_valid_transitions,
    transition_state,
)


# --- Tests for state definitions and helpers ---


class TestProjectStateDefinitions:
    """Test state machine definitions and helper functions."""

    def test_all_states_defined(self):
        """All expected states are in ProjectState.ALL."""
        expected = {"Draft", "Active", "Reviewing", "Interviewing", "Offer Extended", "Filled", "Archived"}
        assert ProjectState.ALL == expected

    def test_valid_transitions_from_draft(self):
        """Draft can transition to Active or Archived."""
        assert VALID_TRANSITIONS[ProjectState.DRAFT] == {ProjectState.ACTIVE, ProjectState.ARCHIVED}

    def test_valid_transitions_from_active(self):
        """Active can transition to Reviewing or Archived."""
        assert VALID_TRANSITIONS[ProjectState.ACTIVE] == {ProjectState.REVIEWING, ProjectState.ARCHIVED}

    def test_valid_transitions_from_reviewing(self):
        """Reviewing can transition to Interviewing or Archived."""
        assert VALID_TRANSITIONS[ProjectState.REVIEWING] == {ProjectState.INTERVIEWING, ProjectState.ARCHIVED}

    def test_valid_transitions_from_interviewing(self):
        """Interviewing can transition to Offer Extended or Archived."""
        assert VALID_TRANSITIONS[ProjectState.INTERVIEWING] == {ProjectState.OFFER_EXTENDED, ProjectState.ARCHIVED}

    def test_valid_transitions_from_offer_extended(self):
        """Offer Extended can transition to Filled or Archived."""
        assert VALID_TRANSITIONS[ProjectState.OFFER_EXTENDED] == {ProjectState.FILLED, ProjectState.ARCHIVED}

    def test_valid_transitions_from_filled(self):
        """Filled can only transition to Archived."""
        assert VALID_TRANSITIONS[ProjectState.FILLED] == {ProjectState.ARCHIVED}

    def test_archived_is_terminal(self):
        """Archived is a terminal state with no valid transitions."""
        assert VALID_TRANSITIONS[ProjectState.ARCHIVED] == set()

    def test_every_state_can_reach_archived(self):
        """Every non-Archived state can transition to Archived."""
        for state in ProjectState.ALL:
            if state != ProjectState.ARCHIVED:
                assert ProjectState.ARCHIVED in VALID_TRANSITIONS[state], (
                    f"{state} should be able to transition to Archived"
                )

    def test_get_valid_transitions_returns_sorted_list(self):
        """get_valid_transitions returns a sorted list of valid targets."""
        result = get_valid_transitions(ProjectState.DRAFT)
        assert result == sorted(result)
        assert "Active" in result
        assert "Archived" in result

    def test_get_valid_transitions_for_archived(self):
        """get_valid_transitions for Archived returns empty list."""
        result = get_valid_transitions(ProjectState.ARCHIVED)
        assert result == []

    def test_get_valid_transitions_for_unknown_state(self):
        """get_valid_transitions for unknown state returns empty list."""
        result = get_valid_transitions("NonExistent")
        assert result == []


class TestAuthorizedRoles:
    """Test role-based authorization definitions."""

    def test_authorized_roles(self):
        """Only Hiring_Manager, Admin, and Owner can transition."""
        assert TRANSITION_AUTHORIZED_ROLES == {"Hiring_Manager", "Admin", "Owner"}

    def test_viewer_not_authorized(self):
        """Viewer role is not authorized."""
        assert "Viewer" not in TRANSITION_AUTHORIZED_ROLES

    def test_recruiter_not_authorized(self):
        """Recruiter role is not authorized."""
        assert "Recruiter" not in TRANSITION_AUTHORIZED_ROLES


# --- Tests for transition_state function ---


class TestTransitionStateAuthorization:
    """Test role-based authorization in transition_state."""

    @pytest.mark.asyncio
    async def test_forbidden_for_viewer_role(self):
        """Viewer role gets ForbiddenException."""
        session = AsyncMock()
        with pytest.raises(ForbiddenException) as exc_info:
            await transition_state(
                session=session,
                project_id=uuid.uuid4(),
                new_state="Active",
                actor_user_id="user-123",
                actor_role="Viewer",
            )
        assert "Only Hiring_Manager, Admin, or Owner" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_forbidden_for_recruiter_role(self):
        """Recruiter role gets ForbiddenException."""
        session = AsyncMock()
        with pytest.raises(ForbiddenException):
            await transition_state(
                session=session,
                project_id=uuid.uuid4(),
                new_state="Active",
                actor_user_id="user-123",
                actor_role="Recruiter",
            )

    @pytest.mark.asyncio
    async def test_forbidden_for_none_role(self):
        """None role gets ForbiddenException."""
        session = AsyncMock()
        with pytest.raises(ForbiddenException):
            await transition_state(
                session=session,
                project_id=uuid.uuid4(),
                new_state="Active",
                actor_user_id="user-123",
                actor_role=None,
            )


class TestTransitionStateProjectNotFound:
    """Test project not found handling."""

    @pytest.mark.asyncio
    async def test_not_found_raises_exception(self):
        """NotFoundException raised when project doesn't exist."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=None)

            with pytest.raises(NotFoundException) as exc_info:
                await transition_state(
                    session=session,
                    project_id=project_id,
                    new_state="Active",
                    actor_user_id="user-123",
                    actor_role="Admin",
                )
            assert "not found" in exc_info.value.message


class TestTransitionStateInvalidTransition:
    """Test invalid state transition handling."""

    @pytest.mark.asyncio
    async def test_conflict_for_invalid_transition(self):
        """ConflictException raised for invalid transition."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = "Draft"
        mock_project.state_history = []

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            with pytest.raises(ConflictException) as exc_info:
                await transition_state(
                    session=session,
                    project_id=project_id,
                    new_state="Filled",  # Invalid from Draft
                    actor_user_id="user-123",
                    actor_role="Admin",
                )
            assert "Invalid state transition" in exc_info.value.message
            assert "Draft" in exc_info.value.message
            assert exc_info.value.details is not None

    @pytest.mark.asyncio
    async def test_conflict_from_archived_state(self):
        """ConflictException raised for any transition from Archived."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = "Archived"
        mock_project.state_history = []

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            with pytest.raises(ConflictException) as exc_info:
                await transition_state(
                    session=session,
                    project_id=project_id,
                    new_state="Active",
                    actor_user_id="user-123",
                    actor_role="Admin",
                )
            assert "Invalid state transition" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_conflict_includes_valid_transitions_in_details(self):
        """ConflictException includes valid transitions for current state."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = "Active"
        mock_project.state_history = []

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            with pytest.raises(ConflictException) as exc_info:
                await transition_state(
                    session=session,
                    project_id=project_id,
                    new_state="Filled",  # Invalid from Active
                    actor_user_id="user-123",
                    actor_role="Owner",
                )
            # Details should list valid transitions
            details = exc_info.value.details
            assert details is not None
            valid_trans_detail = next(
                d for d in details if d["field"] == "valid_transitions"
            )
            assert "Archived" in valid_trans_detail["message"]
            assert "Reviewing" in valid_trans_detail["message"]


class TestTransitionStatePrerequisites:
    """Test prerequisite validation for transitions."""

    @pytest.mark.asyncio
    async def test_draft_to_active_fails_without_completed_candidate(self):
        """Draft→Active fails if no candidate has completed processing."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = "Draft"
        mock_project.state_history = []

        # Mock the count query to return 0
        mock_result = MagicMock()
        mock_result.scalar.return_value = 0
        session.execute = AsyncMock(return_value=mock_result)

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            with pytest.raises(UnprocessableException) as exc_info:
                await transition_state(
                    session=session,
                    project_id=project_id,
                    new_state="Active",
                    actor_user_id="user-123",
                    actor_role="Admin",
                )
            assert "Prerequisites not met" in exc_info.value.message
            assert exc_info.value.details is not None
            assert "completed processing" in exc_info.value.details[0]["message"]

    @pytest.mark.asyncio
    async def test_active_to_reviewing_fails_without_candidates(self):
        """Active→Reviewing fails if no candidates in project."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = "Active"
        mock_project.state_history = []

        mock_result = MagicMock()
        mock_result.scalar.return_value = 0
        session.execute = AsyncMock(return_value=mock_result)

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            with pytest.raises(UnprocessableException) as exc_info:
                await transition_state(
                    session=session,
                    project_id=project_id,
                    new_state="Reviewing",
                    actor_user_id="user-123",
                    actor_role="Hiring_Manager",
                )
            assert "Prerequisites not met" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_reviewing_to_interviewing_fails_without_interview_candidate(self):
        """Reviewing→Interviewing fails if no candidate selected for interview."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = "Reviewing"
        mock_project.state_history = []

        mock_result = MagicMock()
        mock_result.scalar.return_value = 0
        session.execute = AsyncMock(return_value=mock_result)

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            with pytest.raises(UnprocessableException) as exc_info:
                await transition_state(
                    session=session,
                    project_id=project_id,
                    new_state="Interviewing",
                    actor_user_id="user-123",
                    actor_role="Owner",
                )
            assert "Prerequisites not met" in exc_info.value.message
            assert "interview" in exc_info.value.details[0]["message"]

    @pytest.mark.asyncio
    async def test_interviewing_to_offer_fails_without_offer_candidate(self):
        """Interviewing→Offer Extended fails if no candidate marked for offer."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = "Interviewing"
        mock_project.state_history = []

        mock_result = MagicMock()
        mock_result.scalar.return_value = 0
        session.execute = AsyncMock(return_value=mock_result)

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            with pytest.raises(UnprocessableException) as exc_info:
                await transition_state(
                    session=session,
                    project_id=project_id,
                    new_state="Offer Extended",
                    actor_user_id="user-123",
                    actor_role="Admin",
                )
            assert "Prerequisites not met" in exc_info.value.message
            assert "offer" in exc_info.value.details[0]["message"]

    @pytest.mark.asyncio
    async def test_offer_to_filled_fails_without_accepted_candidate(self):
        """Offer Extended→Filled fails if no candidate with accepted offer."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = "Offer Extended"
        mock_project.state_history = []

        mock_result = MagicMock()
        mock_result.scalar.return_value = 0
        session.execute = AsyncMock(return_value=mock_result)

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            with pytest.raises(UnprocessableException) as exc_info:
                await transition_state(
                    session=session,
                    project_id=project_id,
                    new_state="Filled",
                    actor_user_id="user-123",
                    actor_role="Admin",
                )
            assert "Prerequisites not met" in exc_info.value.message
            assert "accepted offer" in exc_info.value.details[0]["message"]


class TestTransitionStateSuccess:
    """Test successful state transitions."""

    @pytest.mark.asyncio
    async def test_archive_from_any_state_no_prerequisites(self):
        """Any state → Archived succeeds without prerequisites."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = "Active"
        mock_project.state_history = []

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            session.flush = AsyncMock()
            session.refresh = AsyncMock()

            result = await transition_state(
                session=session,
                project_id=project_id,
                new_state="Archived",
                actor_user_id="user-123",
                actor_role="Admin",
            )

            assert result.state == "Archived"
            session.flush.assert_called_once()
            session.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_successful_transition_records_history(self):
        """Successful transition appends state history entry."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = "Draft"
        mock_project.state_history = []

        # Mock prerequisite check to pass (1 completed candidate)
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

            result = await transition_state(
                session=session,
                project_id=project_id,
                new_state="Active",
                actor_user_id="user-456",
                actor_role="Hiring_Manager",
            )

            # Verify history was appended
            history = result.state_history
            assert len(history) == 1
            entry = history[0]
            assert entry["previous_state"] == "Draft"
            assert entry["new_state"] == "Active"
            assert entry["actor_id"] == "user-456"
            assert "timestamp" in entry

    @pytest.mark.asyncio
    async def test_transition_to_filled_sets_filled_at(self):
        """Transitioning to Filled sets the filled_at timestamp."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        mock_project = MagicMock()
        mock_project.state = "Offer Extended"
        mock_project.state_history = []
        mock_project.filled_at = None

        # Mock prerequisite check to pass
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

            result = await transition_state(
                session=session,
                project_id=project_id,
                new_state="Filled",
                actor_user_id="user-123",
                actor_role="Owner",
            )

            assert result.filled_at is not None

    @pytest.mark.asyncio
    async def test_history_accumulates_across_transitions(self):
        """State history accumulates entries across multiple transitions."""
        session = AsyncMock()
        project_id = uuid.uuid4()

        existing_history = [
            {
                "previous_state": "Draft",
                "new_state": "Active",
                "actor_id": "user-001",
                "timestamp": "2024-01-10T10:00:00+00:00",
            }
        ]

        mock_project = MagicMock()
        mock_project.state = "Active"
        mock_project.state_history = existing_history

        # Mock prerequisite check to pass
        mock_result = MagicMock()
        mock_result.scalar.return_value = 3
        session.execute = AsyncMock(return_value=mock_result)
        session.flush = AsyncMock()
        session.refresh = AsyncMock()

        with patch(
            "app.features.hiring_projects.state_machine.HiringProjectRepository"
        ) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get = AsyncMock(return_value=mock_project)

            result = await transition_state(
                session=session,
                project_id=project_id,
                new_state="Reviewing",
                actor_user_id="user-002",
                actor_role="Admin",
            )

            history = result.state_history
            assert len(history) == 2
            assert history[0]["previous_state"] == "Draft"
            assert history[1]["previous_state"] == "Active"
            assert history[1]["new_state"] == "Reviewing"
            assert history[1]["actor_id"] == "user-002"
