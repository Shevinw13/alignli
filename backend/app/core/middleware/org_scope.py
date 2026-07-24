"""Organization scoping middleware.

Runs AFTER the auth middleware to:
- Inject org_id into all database queries via the session context variable
- Validate the user belongs to the organization on every request
- Return 404 (not "forbidden") for cross-org resource access attempts
- Log cross-org access attempts with user ID, org ID, target resource, and timestamp

Requirements: 16.1, 16.2, 16.3, 16.6
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

from app.core.database.session import set_current_org_id

logger = logging.getLogger(__name__)

# Paths that do not require org scoping (public/health/auth routes)
EXCLUDED_PATHS: set[str] = {
    "/health",
    "/health/db",
    "/docs",
    "/redoc",
    "/openapi.json",
}

# Path prefixes that are excluded from org scoping
EXCLUDED_PREFIXES: tuple[str, ...] = (
    "/api/v1/auth/",
    "/api/v1/webhooks/",
)


class OrgScopeMiddleware(BaseHTTPMiddleware):
    """Middleware that enforces organization-level data isolation.

    This middleware:
    1. Extracts org_id from the authenticated user's context (set by auth middleware)
    2. Validates the user belongs to that organization
    3. Sets the org_id in the database session context variable for RLS enforcement
    4. Returns 404 for any cross-org resource access (to not reveal existence)
    5. Logs cross-org access attempts to audit_logs

    The middleware expects the auth middleware to have already set:
    - request.state.user_id: The authenticated user's ID
    - request.state.org_id: The organization ID from JWT claims
    - request.state.user_org_ids: List of org IDs the user belongs to (optional)
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process the request through org scoping."""
        # Skip excluded paths
        if _is_excluded_path(request.url.path):
            return await call_next(request)

        # Skip if no user context (unauthenticated request handled by auth middleware)
        if not hasattr(request.state, "user_id") or not request.state.user_id:
            return await call_next(request)

        # Extract org context from auth middleware
        user_id: Optional[str] = getattr(request.state, "user_id", None)
        org_id: Optional[str] = getattr(request.state, "org_id", None)

        if not org_id:
            # No org context means the user hasn't selected an organization
            # This is valid for certain flows (e.g., org creation)
            return await call_next(request)

        # Validate user belongs to the organization
        user_org_ids: list[str] = getattr(request.state, "user_org_ids", [])

        if user_org_ids and org_id not in user_org_ids:
            # Cross-org access attempt detected
            _log_cross_org_attempt(
                user_id=user_id,
                user_org_ids=user_org_ids,
                target_org_id=org_id,
                resource_path=request.url.path,
                method=request.method,
            )
            # Return 404 identical to "not found" to not reveal resource existence
            return JSONResponse(
                status_code=404,
                content={"detail": "Not found"},
            )

        # Set the org_id in session context for database query scoping
        set_current_org_id(org_id)

        # Store validated org_id for downstream use
        request.state.validated_org_id = org_id

        try:
            response = await call_next(request)
            return response
        finally:
            # Clean up the context variable after the request completes
            set_current_org_id(None)


def _is_excluded_path(path: str) -> bool:
    """Check if the request path is excluded from org scoping."""
    if path in EXCLUDED_PATHS:
        return True
    for prefix in EXCLUDED_PREFIXES:
        if path.startswith(prefix):
            return True
    return False


def _log_cross_org_attempt(
    user_id: Optional[str],
    user_org_ids: list[str],
    target_org_id: str,
    resource_path: str,
    method: str,
) -> None:
    """Log a cross-organization access attempt.

    Logs the attempt with structured data for audit purposes.
    This writes to the application logger; in production this feeds into
    the audit_logs table via the audit logging service (task 2.8).

    Args:
        user_id: The requesting user's ID.
        user_org_ids: The organizations the user belongs to.
        target_org_id: The org ID being accessed.
        resource_path: The API path being accessed.
        method: The HTTP method of the request.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    logger.warning(
        "Cross-org access attempt detected",
        extra={
            "event_type": "cross_org_access_attempt",
            "user_id": user_id,
            "user_org_ids": user_org_ids,
            "target_org_id": target_org_id,
            "resource_path": resource_path,
            "method": method,
            "timestamp": timestamp,
        },
    )


def validate_resource_org(
    resource_org_id: Optional[str],
    request_org_id: Optional[str],
    user_id: Optional[str] = None,
    resource_type: str = "resource",
    resource_id: Optional[str] = None,
) -> bool:
    """Validate that a resource belongs to the requesting organization.

    Use this function in route handlers when loading a specific resource
    to verify it belongs to the current user's organization. If validation
    fails, the route handler should return a 404 response.

    Args:
        resource_org_id: The organization_id of the resource being accessed.
        request_org_id: The org_id from the current request context.
        user_id: The requesting user's ID (for logging).
        resource_type: Type of resource for logging (e.g., "hiring_project").
        resource_id: ID of the resource for logging.

    Returns:
        True if the resource belongs to the requesting org, False otherwise.
    """
    if not resource_org_id or not request_org_id:
        return False

    if resource_org_id != request_org_id:
        timestamp = datetime.now(timezone.utc).isoformat()
        logger.warning(
            "Cross-org resource access attempt",
            extra={
                "event_type": "cross_org_resource_access",
                "user_id": user_id,
                "request_org_id": request_org_id,
                "resource_org_id": resource_org_id,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "timestamp": timestamp,
            },
        )
        return False

    return True
