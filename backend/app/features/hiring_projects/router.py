"""API routes for Hiring Projects.

Endpoints:
- POST /api/v1/projects — Create a new project (returns 201)
- GET /api/v1/projects — List projects (paginated, org-scoped)
- GET /api/v1/projects/{id} — Get project details
- PATCH /api/v1/projects/{id}/state — Transition project state

Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 21.1, 21.2, 21.3, 21.5, 21.6, 21.7
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.status import HTTP_201_CREATED

from app.core.database.session import get_db
from app.core.middleware.auth import AuthenticatedUser, get_current_user
from app.features.hiring_projects.schemas import (
    ProjectCreateRequest,
    ProjectListResponse,
    ProjectResponse,
    StateTransitionRequest,
)
from app.features.hiring_projects.service import HiringProjectService
from app.features.hiring_projects.state_machine import transition_state

router = APIRouter(prefix="/projects", tags=["Hiring Projects"])


def _get_service(session: AsyncSession = Depends(get_db)) -> HiringProjectService:
    """Dependency to create HiringProjectService with the current session."""
    return HiringProjectService(session)


@router.post("", status_code=HTTP_201_CREATED, response_model=ProjectResponse)
async def create_project(
    data: ProjectCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    service: HiringProjectService = Depends(_get_service),
) -> ProjectResponse:
    """Create a new hiring project.

    The project is created in Draft state and scoped to the
    authenticated user's organization.
    """
    project = await service.create_project(data)
    return ProjectResponse.model_validate(project)


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=50, description="Items per page"),
    user: AuthenticatedUser = Depends(get_current_user),
    service: HiringProjectService = Depends(_get_service),
) -> ProjectListResponse:
    """List hiring projects for the current organization.

    Results are paginated and sorted by most recently updated first.
    Only non-deleted projects in the user's organization are returned.
    """
    result = await service.list_projects(page=page, page_size=page_size)
    return ProjectListResponse(
        items=[ProjectResponse.model_validate(p) for p in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
        total_pages=result.total_pages,
        has_next=result.has_next,
        has_previous=result.has_previous,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    service: HiringProjectService = Depends(_get_service),
) -> ProjectResponse:
    """Get a single hiring project by ID.

    Returns 404 if the project does not exist or belongs to a different org.
    """
    project = await service.get_project(project_id)
    return ProjectResponse.model_validate(project)


@router.patch("/{project_id}/state", response_model=ProjectResponse)
async def transition_project_state(
    project_id: UUID,
    data: StateTransitionRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Transition a hiring project to a new state.

    Validates:
    - Actor has authorized role (Hiring_Manager, Admin, Owner)
    - The transition is valid from the current state
    - Prerequisites for the transition are met

    Returns:
        409 Conflict: Invalid state transition with valid transitions listed.
        422 Unprocessable: Prerequisites not met.
        403 Forbidden: Insufficient role.

    Requirements: 21.1, 21.2, 21.3, 21.5, 21.6, 21.7
    """
    project = await transition_state(
        session=session,
        project_id=project_id,
        new_state=data.state,
        actor_user_id=user.user_id,
        actor_role=user.role,
    )
    return ProjectResponse.model_validate(project)
