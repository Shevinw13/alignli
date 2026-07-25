"""Property-based tests for project creation validation and initial state.

These tests verify universal project creation properties under randomized inputs:
- Property 16: Project Creation Input Validation
- Property 17: New Projects Start in Draft State

Validates: Requirements 3.2, 3.4, 3.5, 3.6
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st
from pydantic import ValidationError

from app.features.hiring_projects.schemas import (
    EmploymentType,
    ProjectCreateRequest,
    RemotePreference,
)
from app.features.hiring_projects.service import HiringProjectService


# --- Strategies ---

# Valid employment type values
VALID_EMPLOYMENT_TYPES = [e.value for e in EmploymentType]

# Valid remote preference values
VALID_REMOTE_PREFERENCES = [r.value for r in RemotePreference]

# Strategy for valid UUIDs
uuid_strategy = st.uuids().map(str)

# Strategy for valid titles (1-100 chars, no HTML, non-whitespace-only)
valid_title_strategy = st.text(
    alphabet=st.characters(
        whitelist_categories=("L", "N", "P", "Z"),
        blacklist_characters="<>&",
    ),
    min_size=1,
    max_size=100,
).filter(lambda s: len(s.strip()) >= 1)

# Strategy for valid locations (1-100 chars, no HTML, non-whitespace-only)
valid_location_strategy = st.text(
    alphabet=st.characters(
        whitelist_categories=("L", "N", "P", "Z"),
        blacklist_characters="<>&",
    ),
    min_size=1,
    max_size=100,
).filter(lambda s: len(s.strip()) >= 1)

# Strategy for valid employment types
valid_employment_type_strategy = st.sampled_from(VALID_EMPLOYMENT_TYPES)

# Strategy for valid remote preferences
valid_remote_preference_strategy = st.sampled_from(VALID_REMOTE_PREFERENCES)

# Strategy for titles that exceed max length (>100 chars after strip)
too_long_title_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N")),
    min_size=101,
    max_size=200,
)

# Strategy for locations that exceed max length (>100 chars after strip)
too_long_location_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N")),
    min_size=101,
    max_size=200,
)

# Strategy for invalid employment types (not in the valid set)
invalid_employment_type_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L",)),
    min_size=1,
    max_size=50,
).filter(lambda s: s not in VALID_EMPLOYMENT_TYPES)

# Strategy for invalid remote preferences (not in the valid set)
invalid_remote_preference_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L",)),
    min_size=1,
    max_size=50,
).filter(lambda s: s not in VALID_REMOTE_PREFERENCES)

# Strategy for empty or whitespace-only strings
empty_string_strategy = st.sampled_from(["", " ", "  ", "\t", "\n", "   \t\n  "])


# --- Property 16: Project Creation Input Validation ---


class TestProjectCreationInputValidation:
    """Property 16: Project Creation Input Validation.

    *For any* project creation input, if title exceeds 100 characters,
    OR location exceeds 100 characters, OR employment_type is not in
    {Full-time, Part-time, Contract, Temporary}, OR remote_preference
    is not in {Remote, Hybrid, On-site}, OR any required field is empty,
    the system SHALL reject the input with specific validation errors
    and SHALL NOT create a project.

    **Validates: Requirements 3.2, 3.5, 3.6**
    """

    @given(title=too_long_title_strategy, manager_id=st.uuids())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_title_exceeding_100_chars_rejected(
        self, title: str, manager_id: uuid.UUID
    ):
        """Titles exceeding 100 characters are always rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ProjectCreateRequest(
                title=title,
                location="New York",
                employment_type="Full-time",
                remote_preference="Remote",
                assigned_manager_id=manager_id,
            )
        # Verify error mentions the title field
        errors = exc_info.value.errors()
        assert any(
            "title" in str(e.get("loc", "")) for e in errors
        ), f"Expected title error but got: {errors}"

    @given(location=too_long_location_strategy, manager_id=st.uuids())
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_location_exceeding_100_chars_rejected(
        self, location: str, manager_id: uuid.UUID
    ):
        """Locations exceeding 100 characters are always rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ProjectCreateRequest(
                title="Software Engineer",
                location=location,
                employment_type="Full-time",
                remote_preference="Remote",
                assigned_manager_id=manager_id,
            )
        errors = exc_info.value.errors()
        assert any(
            "location" in str(e.get("loc", "")) for e in errors
        ), f"Expected location error but got: {errors}"

    @given(
        invalid_type=invalid_employment_type_strategy,
        manager_id=st.uuids(),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_invalid_employment_type_rejected(
        self, invalid_type: str, manager_id: uuid.UUID
    ):
        """Employment types not in {Full-time, Part-time, Contract, Temporary} are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ProjectCreateRequest(
                title="Software Engineer",
                location="New York",
                employment_type=invalid_type,
                remote_preference="Remote",
                assigned_manager_id=manager_id,
            )
        errors = exc_info.value.errors()
        assert any(
            "employment_type" in str(e.get("loc", "")) for e in errors
        ), f"Expected employment_type error but got: {errors}"

    @given(
        invalid_pref=invalid_remote_preference_strategy,
        manager_id=st.uuids(),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_invalid_remote_preference_rejected(
        self, invalid_pref: str, manager_id: uuid.UUID
    ):
        """Remote preferences not in {Remote, Hybrid, On-site} are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ProjectCreateRequest(
                title="Software Engineer",
                location="New York",
                employment_type="Full-time",
                remote_preference=invalid_pref,
                assigned_manager_id=manager_id,
            )
        errors = exc_info.value.errors()
        assert any(
            "remote_preference" in str(e.get("loc", "")) for e in errors
        ), f"Expected remote_preference error but got: {errors}"

    @given(
        empty_title=empty_string_strategy,
        manager_id=st.uuids(),
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_empty_title_rejected(self, empty_title: str, manager_id: uuid.UUID):
        """Empty or whitespace-only titles are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ProjectCreateRequest(
                title=empty_title,
                location="New York",
                employment_type="Full-time",
                remote_preference="Remote",
                assigned_manager_id=manager_id,
            )
        errors = exc_info.value.errors()
        assert any(
            "title" in str(e.get("loc", "")) for e in errors
        ), f"Expected title error but got: {errors}"

    @given(
        empty_location=empty_string_strategy,
        manager_id=st.uuids(),
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_empty_location_rejected(
        self, empty_location: str, manager_id: uuid.UUID
    ):
        """Empty or whitespace-only locations are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            ProjectCreateRequest(
                title="Software Engineer",
                location=empty_location,
                employment_type="Full-time",
                remote_preference="Remote",
                assigned_manager_id=manager_id,
            )
        errors = exc_info.value.errors()
        assert any(
            "location" in str(e.get("loc", "")) for e in errors
        ), f"Expected location error but got: {errors}"

    @given(
        title=valid_title_strategy,
        location=valid_location_strategy,
        employment_type=valid_employment_type_strategy,
        remote_preference=valid_remote_preference_strategy,
        manager_id=st.uuids(),
    )
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    def test_valid_inputs_accepted(
        self,
        title: str,
        location: str,
        employment_type: str,
        remote_preference: str,
        manager_id: uuid.UUID,
    ):
        """All valid combinations of inputs are accepted without errors."""
        req = ProjectCreateRequest(
            title=title,
            location=location,
            employment_type=employment_type,
            remote_preference=remote_preference,
            assigned_manager_id=manager_id,
        )
        # Verify parsed values match expectations
        assert req.employment_type.value == employment_type
        assert req.remote_preference.value == remote_preference
        assert req.assigned_manager_id == manager_id
        # Title and location should be sanitized (trimmed) but within bounds
        assert 1 <= len(req.title) <= 100
        assert 1 <= len(req.location) <= 100

    @given(manager_id=st.uuids())
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_missing_required_fields_rejected(self, manager_id: uuid.UUID):
        """Omitting any required field raises a ValidationError."""
        # Missing title
        with pytest.raises(ValidationError):
            ProjectCreateRequest(
                location="NY",
                employment_type="Full-time",
                remote_preference="Remote",
                assigned_manager_id=manager_id,
            )

        # Missing location
        with pytest.raises(ValidationError):
            ProjectCreateRequest(
                title="Engineer",
                employment_type="Full-time",
                remote_preference="Remote",
                assigned_manager_id=manager_id,
            )

        # Missing employment_type
        with pytest.raises(ValidationError):
            ProjectCreateRequest(
                title="Engineer",
                location="NY",
                remote_preference="Remote",
                assigned_manager_id=manager_id,
            )

        # Missing remote_preference
        with pytest.raises(ValidationError):
            ProjectCreateRequest(
                title="Engineer",
                location="NY",
                employment_type="Full-time",
                assigned_manager_id=manager_id,
            )

        # Missing assigned_manager_id
        with pytest.raises(ValidationError):
            ProjectCreateRequest(
                title="Engineer",
                location="NY",
                employment_type="Full-time",
                remote_preference="Remote",
            )


# --- Property 17: New Projects Start in Draft State ---


class TestNewProjectsStartInDraftState:
    """Property 17: New Projects Start in Draft State.

    *For any* newly created Hiring Project, regardless of input values,
    the initial state SHALL be 'Draft'.

    **Validates: Requirements 3.4**
    """

    @given(
        title=valid_title_strategy,
        location=valid_location_strategy,
        employment_type=valid_employment_type_strategy,
        remote_preference=valid_remote_preference_strategy,
        manager_id=st.uuids(),
    )
    @settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
    @pytest.mark.asyncio
    async def test_created_project_always_has_draft_state(
        self,
        title: str,
        location: str,
        employment_type: str,
        remote_preference: str,
        manager_id: uuid.UUID,
    ):
        """Regardless of input values, new projects always start in Draft state."""
        mock_session = AsyncMock()
        service = HiringProjectService(mock_session)

        # Mock repository to capture what state is passed
        mock_project = MagicMock()
        mock_project.state = "Draft"
        mock_project.id = uuid.uuid4()
        mock_project.organization_id = uuid.uuid4()
        mock_project.title = title.strip()
        mock_project.location = location.strip()
        mock_project.employment_type = employment_type
        mock_project.remote_preference = remote_preference
        mock_project.assigned_manager_id = manager_id
        mock_project.created_at = "2024-01-01T00:00:00Z"
        mock_project.updated_at = "2024-01-01T00:00:00Z"

        service.repository = AsyncMock()
        service.repository.create = AsyncMock(return_value=mock_project)

        data = ProjectCreateRequest(
            title=title,
            location=location,
            employment_type=employment_type,
            remote_preference=remote_preference,
            assigned_manager_id=manager_id,
        )

        result = await service.create_project(data)

        # Verify state="Draft" is always passed to repository.create
        call_kwargs = service.repository.create.call_args[1]
        assert call_kwargs["state"] == "Draft", (
            f"Expected state='Draft' but got state='{call_kwargs['state']}'"
        )

        # Verify the returned project has Draft state
        assert result.state == "Draft"

    @given(
        title=valid_title_strategy,
        location=valid_location_strategy,
        employment_type=valid_employment_type_strategy,
        remote_preference=valid_remote_preference_strategy,
        manager_id=st.uuids(),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_schema_does_not_accept_state_override(
        self,
        title: str,
        location: str,
        employment_type: str,
        remote_preference: str,
        manager_id: uuid.UUID,
    ):
        """ProjectCreateRequest schema does not allow setting state directly.

        This ensures clients cannot override the initial Draft state via input.
        """
        # The schema should not have a 'state' field - any extra field is ignored or rejected
        req = ProjectCreateRequest(
            title=title,
            location=location,
            employment_type=employment_type,
            remote_preference=remote_preference,
            assigned_manager_id=manager_id,
        )
        # Verify the schema doesn't expose a 'state' attribute
        assert not hasattr(req, "state") or "state" not in req.model_fields
