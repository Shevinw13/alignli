"""Project state machine with transition validation.

Defines valid state transitions for hiring projects, validates prerequisites,
enforces role-based authorization, and records state history.

Valid Transitions:
    Draft → Active (requires ≥1 candidate with completed processing)
    Active → Reviewing (requires ≥1 candidate in project)
    Reviewing → Interviewing (requires ≥1 candidate selected for interview)
    Interviewing → Offer Extended (requires ≥1 candidate marked for offer)
    Offer Extended → Filled (requires ≥1 candidate with accepted offer)
    Any state → Archived (no prerequisites)

Requirements: 21.1, 21.2, 21.3, 21.5, 21.6, 21.7
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security.exceptions import (
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnprocessableException,
)
from app.features.hiring_projects.repository import HiringProjectRepository
from app.models.candidates import Candidate
from app.models.hiring_projects import HiringProject


# --- State Definitions ---

class ProjectState:
    """Valid project states."""

    DRAFT = "Draft"
    ACTIVE = "Active"
    REVIEWING = "Reviewing"
    INTERVIEWING = "Interviewing"
    OFFER_EXTENDED = "Offer Extended"
    FILLED = "Filled"
    ARCHIVED = "Archived"

    ALL = {DRAFT, ACTIVE, REVIEWING, INTERVIEWING, OFFER_EXTENDED, FILLED, ARCHIVED}


# Valid transitions: source_state -> set of allowed target states
VALID_TRANSITIONS: dict[str, set[str]] = {
    ProjectState.DRAFT: {ProjectState.ACTIVE, ProjectState.ARCHIVED},
    ProjectState.ACTIVE: {ProjectState.REVIEWING, ProjectState.ARCHIVED},
    ProjectState.REVIEWING: {ProjectState.INTERVIEWING, ProjectState.ARCHIVED},
    ProjectState.INTERVIEWING: {ProjectState.OFFER_EXTENDED, ProjectState.ARCHIVED},
    ProjectState.OFFER_EXTENDED: {ProjectState.FILLED, ProjectState.ARCHIVED},
    ProjectState.FILLED: {ProjectState.ARCHIVED},
    ProjectState.ARCHIVED: set(),  # Terminal state — no transitions out
}

# Roles authorized to perform state transitions
TRANSITION_AUTHORIZED_ROLES: set[str] = {"Hiring_Manager", "Admin", "Owner"}


def get_valid_transitions(current_state: str) -> list[str]:
    """Get list of valid target states from the current state."""
    return sorted(VALID_TRANSITIONS.get(current_state, set()))


# --- Prerequisite Checks ---


async def _check_draft_to_active(session: AsyncSession, project_id: UUID) -> list[str]:
    """Check prerequisites for Draft → Active transition.

    Requires at least 1 candidate with completed processing.
    """
    query = (
        select(func.count())
        .select_from(Candidate)
        .where(
            Candidate.hiring_project_id == project_id,
            Candidate.deleted_at.is_(None),
            Candidate.processing_status == "completed",
        )
    )
    result = await session.execute(query)
    count = result.scalar() or 0

    if count < 1:
        return ["At least 1 candidate with completed processing is required"]
    return []


async def _check_active_to_reviewing(session: AsyncSession, project_id: UUID) -> list[str]:
    """Check prerequisites for Active → Reviewing transition.

    Requires at least 1 candidate in project.
    """
    query = (
        select(func.count())
        .select_from(Candidate)
        .where(
            Candidate.hiring_project_id == project_id,
            Candidate.deleted_at.is_(None),
        )
    )
    result = await session.execute(query)
    count = result.scalar() or 0

    if count < 1:
        return ["At least 1 candidate in the project is required"]
    return []


async def _check_reviewing_to_interviewing(
    session: AsyncSession, project_id: UUID
) -> list[str]:
    """Check prerequisites for Reviewing → Interviewing transition.

    Requires at least 1 candidate selected for interview.
    """
    query = (
        select(func.count())
        .select_from(Candidate)
        .where(
            Candidate.hiring_project_id == project_id,
            Candidate.deleted_at.is_(None),
            Candidate.status == "interview",
        )
    )
    result = await session.execute(query)
    count = result.scalar() or 0

    if count < 1:
        return ["At least 1 candidate selected for interview is required"]
    return []


async def _check_interviewing_to_offer(session: AsyncSession, project_id: UUID) -> list[str]:
    """Check prerequisites for Interviewing → Offer Extended transition.

    Requires at least 1 candidate marked for offer.
    """
    query = (
        select(func.count())
        .select_from(Candidate)
        .where(
            Candidate.hiring_project_id == project_id,
            Candidate.deleted_at.is_(None),
            Candidate.status == "offer",
        )
    )
    result = await session.execute(query)
    count = result.scalar() or 0

    if count < 1:
        return ["At least 1 candidate marked for offer is required"]
    return []


async def _check_offer_to_filled(session: AsyncSession, project_id: UUID) -> list[str]:
    """Check prerequisites for Offer Extended → Filled transition.

    Requires at least 1 candidate with accepted offer.
    """
    query = (
        select(func.count())
        .select_from(Candidate)
        .where(
            Candidate.hiring_project_id == project_id,
            Candidate.deleted_at.is_(None),
            Candidate.status == "accepted",
        )
    )
    result = await session.execute(query)
    count = result.scalar() or 0

    if count < 1:
        return ["At least 1 candidate with accepted offer is required"]
    return []


# Map of (from_state, to_state) to prerequisite check function
_PREREQUISITE_CHECKS: dict[tuple[str, str], Any] = {
    (ProjectState.DRAFT, ProjectState.ACTIVE): _check_draft_to_active,
    (ProjectState.ACTIVE, ProjectState.REVIEWING): _check_active_to_reviewing,
    (ProjectState.REVIEWING, ProjectState.INTERVIEWING): _check_reviewing_to_interviewing,
    (ProjectState.INTERVIEWING, ProjectState.OFFER_EXTENDED): _check_interviewing_to_offer,
    (ProjectState.OFFER_EXTENDED, ProjectState.FILLED): _check_offer_to_filled,
}


# --- State Machine Service ---


async def transition_state(
    session: AsyncSession,
    project_id: UUID,
    new_state: str,
    actor_user_id: str,
    actor_role: str | None,
) -> HiringProject:
    """Transition a project to a new state with full validation.

    Validates:
    1. Actor has authorized role (Hiring_Manager, Admin, Owner)
    2. The transition is valid from the current state
    3. Prerequisites for the transition are met

    Records a state history entry on successful transition.

    Args:
        session: Active database session.
        project_id: UUID of the project to transition.
        new_state: Target state to transition to.
        actor_user_id: ID of the user performing the transition.
        actor_role: Role of the user performing the transition.

    Returns:
        The updated HiringProject instance.

    Raises:
        ForbiddenException: If user lacks authorization.
        NotFoundException: If project not found.
        ConflictException: If transition is invalid from current state.
        UnprocessableException: If prerequisites are not met.
    """
    # 1. Authorize role
    if actor_role not in TRANSITION_AUTHORIZED_ROLES:
        raise ForbiddenException(
            message="Only Hiring_Manager, Admin, or Owner roles can transition project state"
        )

    # 2. Fetch project
    repository = HiringProjectRepository(session)
    project = await repository.get(project_id)
    if project is None:
        raise NotFoundException(message="The requested project was not found")

    current_state = project.state

    # 3. Validate transition
    valid_targets = VALID_TRANSITIONS.get(current_state, set())
    if new_state not in valid_targets:
        valid_list = get_valid_transitions(current_state)
        raise ConflictException(
            message=(
                f"Invalid state transition from '{current_state}' to '{new_state}'. "
                f"Valid transitions from '{current_state}': {valid_list}"
            ),
            details=[
                {"field": "state", "message": f"Current state: {current_state}"},
                {"field": "valid_transitions", "message": ", ".join(valid_list) if valid_list else "None (terminal state)"},
            ],
        )

    # 4. Check prerequisites
    check_fn = _PREREQUISITE_CHECKS.get((current_state, new_state))
    if check_fn:
        failures = await check_fn(session, project_id)
        if failures:
            raise UnprocessableException(
                message="Prerequisites not met for this state transition",
                details=[{"field": "prerequisites", "message": f} for f in failures],
            )

    # 5. Perform transition
    now = datetime.now(timezone.utc)
    history_entry = {
        "previous_state": current_state,
        "new_state": new_state,
        "actor_id": actor_user_id,
        "timestamp": now.isoformat(),
    }

    # Append to state history
    current_history = list(project.state_history) if project.state_history else []
    current_history.append(history_entry)

    # Update project
    project.state = new_state
    project.state_history = current_history
    project.updated_at = now  # type: ignore[assignment]

    # Set filled_at if transitioning to Filled
    if new_state == ProjectState.FILLED:
        project.filled_at = now  # type: ignore[assignment]

    await session.flush()
    await session.refresh(project)

    return project
