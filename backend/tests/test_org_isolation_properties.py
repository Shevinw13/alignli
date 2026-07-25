"""Property-based tests for organization data isolation.

These tests verify that multi-tenant isolation holds under randomized inputs:
- Property 5: All returned records match the requesting org_id
- Property 6: Cross-org access is indistinguishable from a genuine "not found"

Validates: Requirements 1.3, 16.1, 16.2, 16.3, 16.4, 16.6
"""

from __future__ import annotations

import logging
from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st
from starlette.responses import JSONResponse

from app.core.database.session import get_current_org_id, set_current_org_id
from app.core.middleware.org_scope import OrgScopeMiddleware, validate_resource_org


# --- Strategies ---

# Generate org IDs: non-empty strings that look like realistic org identifiers
org_id_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="_-"),
    min_size=3,
    max_size=50,
).filter(lambda s: len(s.strip()) >= 3)

# Generate user IDs
user_id_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="_-"),
    min_size=3,
    max_size=50,
).filter(lambda s: len(s.strip()) >= 3)

# Generate API paths (non-excluded paths)
api_path_strategy = st.from_regex(
    r"/api/v1/[a-z][a-z0-9_/]{1,50}",
    fullmatch=True,
).filter(
    lambda p: not p.startswith("/api/v1/auth/")
    and not p.startswith("/api/v1/webhooks/")
)

# Generate a list of org_ids a user belongs to (1 to 5 orgs)
user_org_list_strategy = st.lists(org_id_strategy, min_size=1, max_size=5, unique=True)

# HTTP methods for state-changing requests
http_method_strategy = st.sampled_from(["GET", "POST", "PUT", "PATCH", "DELETE"])


# --- Helpers ---


def _create_app_with_org_middleware(
    path: str, response_data: dict[str, Any] | None = None
) -> FastAPI:
    """Create a minimal FastAPI app with the OrgScopeMiddleware for property testing."""
    app = FastAPI()
    app.add_middleware(OrgScopeMiddleware)

    # Register a catch-all route that returns org-scoped data
    @app.api_route(path, methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    async def handler(request: Request):
        org_id = get_current_org_id()
        data = response_data or {}
        return JSONResponse(
            content={
                "org_id": org_id,
                "path": request.url.path,
                **data,
            }
        )

    return app


def _add_fake_auth_middleware(
    app: FastAPI,
    user_id: str,
    org_id: str,
    user_org_ids: list[str],
) -> None:
    """Add a fake auth middleware that sets user context (mimics Clerk auth middleware)."""

    @app.middleware("http")
    async def fake_auth(request: Request, call_next):
        request.state.user_id = user_id
        request.state.org_id = org_id
        request.state.user_org_ids = user_org_ids
        return await call_next(request)


# --- Property 5: Organization Data Isolation ---


class TestOrganizationDataIsolation:
    """Property 5: Organization Data Isolation.

    For any API request from an authenticated user belonging to Organization A,
    all returned database records SHALL have organization_id equal to Organization A's ID,
    and no record belonging to Organization B (where B != A) SHALL appear in any response.

    **Validates: Requirements 1.3, 16.1, 16.2, 16.4, 16.6**
    """

    @given(
        user_id=user_id_strategy,
        org_id=org_id_strategy,
        extra_orgs=st.lists(org_id_strategy, min_size=0, max_size=3),
    )
    @settings(max_examples=100)
    def test_returned_org_id_matches_requesting_org(
        self,
        user_id: str,
        org_id: str,
        extra_orgs: list[str],
    ):
        """All returned records have org_id matching the requesting user's organization.

        **Validates: Requirements 1.3, 16.1, 16.2**
        """
        # User belongs to the org they're requesting as
        user_org_ids = list(set([org_id] + extra_orgs))

        app = _create_app_with_org_middleware("/api/v1/projects")
        _add_fake_auth_middleware(app, user_id, org_id, user_org_ids)

        client = TestClient(app)
        response = client.get("/api/v1/projects")

        assert response.status_code == 200
        data = response.json()
        # The org_id set in the session context must match what was requested
        assert data["org_id"] == org_id

    @given(
        user_id=user_id_strategy,
        org_id=org_id_strategy,
        extra_orgs=st.lists(org_id_strategy, min_size=0, max_size=3),
    )
    @settings(max_examples=100)
    def test_session_context_scoped_to_requesting_org(
        self,
        user_id: str,
        org_id: str,
        extra_orgs: list[str],
    ):
        """The database session context variable is set to the requesting org_id.

        This ensures all downstream database queries are scoped to the correct organization.

        **Validates: Requirements 16.1, 16.4, 16.6**
        """
        user_org_ids = list(set([org_id] + extra_orgs))

        app = FastAPI()
        app.add_middleware(OrgScopeMiddleware)

        captured_org_ids: list[str | None] = []

        @app.get("/api/v1/resources")
        async def get_resources(request: Request):
            # Capture what the downstream handler sees
            captured_org_ids.append(get_current_org_id())
            return {"status": "ok"}

        _add_fake_auth_middleware(app, user_id, org_id, user_org_ids)

        client = TestClient(app)
        response = client.get("/api/v1/resources")

        assert response.status_code == 200
        # The context variable seen by the handler must be the requesting org
        assert len(captured_org_ids) == 1
        assert captured_org_ids[0] == org_id

    @given(
        user_id=user_id_strategy,
        org_id=org_id_strategy,
        extra_orgs=st.lists(org_id_strategy, min_size=0, max_size=3),
    )
    @settings(max_examples=100)
    def test_context_cleaned_after_request(
        self,
        user_id: str,
        org_id: str,
        extra_orgs: list[str],
    ):
        """The org_id context is cleaned up after each request completes.

        Prevents leaking org context between requests in shared connection pools.

        **Validates: Requirements 16.6**
        """
        user_org_ids = list(set([org_id] + extra_orgs))

        app = _create_app_with_org_middleware("/api/v1/projects")
        _add_fake_auth_middleware(app, user_id, org_id, user_org_ids)

        client = TestClient(app)
        response = client.get("/api/v1/projects")
        assert response.status_code == 200

        # After the request completes, context must be cleaned
        assert get_current_org_id() is None

    @given(
        user_id=user_id_strategy,
        resource_org_id=org_id_strategy,
        request_org_id=org_id_strategy,
    )
    @settings(max_examples=200)
    def test_validate_resource_org_only_matches_same_org(
        self,
        user_id: str,
        resource_org_id: str,
        request_org_id: str,
    ):
        """validate_resource_org returns True only when resource org matches request org.

        This is the downstream check handlers use to verify individual resources
        belong to the requesting organization.

        **Validates: Requirements 16.1, 16.2, 16.4**
        """
        result = validate_resource_org(
            resource_org_id=resource_org_id,
            request_org_id=request_org_id,
            user_id=user_id,
        )

        if resource_org_id == request_org_id:
            assert result is True
        else:
            assert result is False


# --- Property 6: Cross-Organization Access Indistinguishable from Not Found ---


class TestCrossOrgAccessIndistinguishableFromNotFound:
    """Property 6: Cross-Organization Access Indistinguishable from Not Found.

    For any request where a user from Organization A attempts to access a resource
    belonging to Organization B, the system SHALL return a response identical in status
    code and body structure to a genuine "resource not found" response, and SHALL log
    the attempt with requesting user ID, their Organization ID, target resource, and timestamp.

    **Validates: Requirements 16.3**
    """

    @given(
        user_id=user_id_strategy,
        user_own_org=org_id_strategy,
        target_org=org_id_strategy,
    )
    @settings(max_examples=100)
    def test_cross_org_returns_404_status(
        self,
        user_id: str,
        user_own_org: str,
        target_org: str,
    ):
        """Cross-org access attempt returns 404 status code, not 403.

        **Validates: Requirements 16.3**
        """
        # Ensure we're testing actual cross-org (different orgs)
        assume(user_own_org != target_org)

        app = _create_app_with_org_middleware("/api/v1/projects")
        # User belongs to user_own_org but requests target_org
        _add_fake_auth_middleware(app, user_id, target_org, [user_own_org])

        client = TestClient(app)
        response = client.get("/api/v1/projects")

        assert response.status_code == 404

    @given(
        user_id=user_id_strategy,
        user_own_org=org_id_strategy,
        target_org=org_id_strategy,
    )
    @settings(max_examples=100)
    def test_cross_org_response_body_matches_not_found(
        self,
        user_id: str,
        user_own_org: str,
        target_org: str,
    ):
        """Cross-org response body is identical to a genuine 'not found' response.

        The response must not leak any information about whether the resource exists
        in another organization.

        **Validates: Requirements 16.3**
        """
        assume(user_own_org != target_org)

        app = _create_app_with_org_middleware("/api/v1/projects")
        _add_fake_auth_middleware(app, user_id, target_org, [user_own_org])

        client = TestClient(app)
        response = client.get("/api/v1/projects")

        # The response body must be exactly {"detail": "Not found"}
        # This is the same structure returned for genuinely missing resources
        assert response.json() == {"detail": "Not found"}

    @given(
        user_id=user_id_strategy,
        user_own_org=org_id_strategy,
        target_org=org_id_strategy,
    )
    @settings(max_examples=100)
    def test_cross_org_response_never_403(
        self,
        user_id: str,
        user_own_org: str,
        target_org: str,
    ):
        """Cross-org access never returns 403 Forbidden.

        A 403 would reveal that the resource exists but belongs to another org,
        violating the isolation requirement.

        **Validates: Requirements 16.3**
        """
        assume(user_own_org != target_org)

        app = _create_app_with_org_middleware("/api/v1/projects")
        _add_fake_auth_middleware(app, user_id, target_org, [user_own_org])

        client = TestClient(app)
        response = client.get("/api/v1/projects")

        assert response.status_code != 403

    @given(
        user_id=user_id_strategy,
        user_own_org=org_id_strategy,
        target_org=org_id_strategy,
    )
    @settings(max_examples=100)
    def test_cross_org_response_no_org_info_leaked(
        self,
        user_id: str,
        user_own_org: str,
        target_org: str,
    ):
        """Cross-org response does not leak organization identifiers.

        The response body must not contain the target org ID, the user's org ID,
        or any indication of cross-org access.

        **Validates: Requirements 16.3**
        """
        assume(user_own_org != target_org)

        app = _create_app_with_org_middleware("/api/v1/projects")
        _add_fake_auth_middleware(app, user_id, target_org, [user_own_org])

        client = TestClient(app)
        response = client.get("/api/v1/projects")

        response_text = response.text.lower()
        # Response should not contain either org ID
        assert target_org.lower() not in response_text
        assert user_own_org.lower() not in response_text
        # Should not contain words that reveal cross-org scenario
        assert "forbidden" not in response_text
        assert "unauthorized" not in response_text
        assert "organization" not in response_text

    @given(
        user_id=user_id_strategy,
        user_own_org=org_id_strategy,
        target_org=org_id_strategy,
        method=http_method_strategy,
    )
    @settings(max_examples=100)
    def test_cross_org_blocked_for_all_http_methods(
        self,
        user_id: str,
        user_own_org: str,
        target_org: str,
        method: str,
    ):
        """Cross-org access returns 404 regardless of HTTP method used.

        **Validates: Requirements 16.3**
        """
        assume(user_own_org != target_org)

        app = _create_app_with_org_middleware("/api/v1/projects")
        _add_fake_auth_middleware(app, user_id, target_org, [user_own_org])

        client = TestClient(app)
        response = client.request(method, "/api/v1/projects")

        assert response.status_code == 404
        assert response.json() == {"detail": "Not found"}

    @given(
        user_id=user_id_strategy,
        user_own_org=org_id_strategy,
        target_org=org_id_strategy,
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_cross_org_attempt_is_logged(
        self,
        user_id: str,
        user_own_org: str,
        target_org: str,
        caplog: pytest.LogCaptureFixture,
    ):
        """Cross-org access attempts are logged with user ID, org ID, target, and timestamp.

        **Validates: Requirements 16.3**
        """
        assume(user_own_org != target_org)

        app = _create_app_with_org_middleware("/api/v1/projects")
        _add_fake_auth_middleware(app, user_id, target_org, [user_own_org])

        client = TestClient(app)

        caplog.clear()
        with caplog.at_level(logging.WARNING):
            response = client.get("/api/v1/projects")

        assert response.status_code == 404
        # Verify that a warning log was emitted about the cross-org access
        assert any(
            "Cross-org access attempt" in record.message for record in caplog.records
        )

    @given(
        user_id=user_id_strategy,
        user_own_org=org_id_strategy,
        target_org=org_id_strategy,
    )
    @settings(max_examples=100)
    def test_cross_org_identical_to_nonexistent_resource(
        self,
        user_id: str,
        user_own_org: str,
        target_org: str,
    ):
        """Cross-org 404 is structurally identical to a genuine nonexistent resource 404.

        Both responses must have:
        - Same status code (404)
        - Same Content-Type header
        - Same body structure

        **Validates: Requirements 16.3**
        """
        assume(user_own_org != target_org)

        # Set up an app that handles cross-org scenario
        app = FastAPI()
        app.add_middleware(OrgScopeMiddleware)

        @app.get("/api/v1/projects")
        async def list_projects(request: Request):
            return {"org_id": get_current_org_id()}

        # Also add a route that naturally returns 404
        @app.get("/api/v1/nonexistent/{item_id}")
        async def get_nonexistent(request: Request, item_id: str):
            return JSONResponse(
                status_code=404,
                content={"detail": "Not found"},
            )

        _add_fake_auth_middleware(app, user_id, target_org, [user_own_org])

        client = TestClient(app)

        # Get cross-org response
        cross_org_response = client.get("/api/v1/projects")

        # Get genuine not-found response (accessing route with valid auth context
        # but simulating not-found in the handler)
        # We use a separate app for the genuine 404 to avoid middleware interference
        app2 = FastAPI()

        @app2.get("/api/v1/nonexistent/{item_id}")
        async def genuine_404(request: Request, item_id: str):
            return JSONResponse(
                status_code=404,
                content={"detail": "Not found"},
            )

        client2 = TestClient(app2)
        genuine_not_found = client2.get("/api/v1/nonexistent/fake-id")

        # Both must be identical in status and body
        assert cross_org_response.status_code == genuine_not_found.status_code
        assert cross_org_response.json() == genuine_not_found.json()
        # Content-Type headers should match
        assert (
            cross_org_response.headers.get("content-type")
            == genuine_not_found.headers.get("content-type")
        )
