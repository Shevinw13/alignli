"""Tests for organization scoping middleware.

Tests validate:
- Org_id is injected into the database session context
- Users are validated against their organization membership
- Cross-org access returns 404 (not 403) to hide resource existence
- Cross-org access attempts are logged with required fields
- Excluded paths bypass org scoping
"""

from __future__ import annotations

import logging
from unittest.mock import patch

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.core.database.session import get_current_org_id, set_current_org_id
from app.core.middleware.org_scope import (
    EXCLUDED_PATHS,
    EXCLUDED_PREFIXES,
    OrgScopeMiddleware,
    _is_excluded_path,
    validate_resource_org,
)


@pytest.fixture
def app_with_middleware() -> FastAPI:
    """Create a test FastAPI app with the OrgScopeMiddleware."""
    app = FastAPI()
    app.add_middleware(OrgScopeMiddleware)

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    @app.get("/api/v1/auth/login")
    async def auth_login():
        return {"status": "ok"}

    @app.get("/api/v1/webhooks/clerk")
    async def webhook():
        return {"status": "ok"}

    @app.get("/api/v1/projects")
    async def list_projects(request: Request):
        # Return the current org_id from the session context
        org_id = get_current_org_id()
        return {"org_id": org_id}

    @app.get("/api/v1/projects/{project_id}")
    async def get_project(request: Request, project_id: str):
        org_id = get_current_org_id()
        return {"org_id": org_id, "project_id": project_id}

    return app


@pytest.fixture
def client(app_with_middleware: FastAPI) -> TestClient:
    """Create a test client."""
    return TestClient(app_with_middleware)


def _set_user_context(
    app: FastAPI,
    user_id: str = "user_123",
    org_id: str = "org_456",
    user_org_ids: list[str] | None = None,
) -> None:
    """Simulate auth middleware by setting user context via a middleware that runs first."""

    @app.middleware("http")
    async def fake_auth_middleware(request: Request, call_next):
        request.state.user_id = user_id
        request.state.org_id = org_id
        if user_org_ids is not None:
            request.state.user_org_ids = user_org_ids
        else:
            request.state.user_org_ids = [org_id]
        return await call_next(request)


class TestOrgScopeMiddleware:
    """Test the OrgScopeMiddleware behavior."""

    def test_sets_org_id_in_session_context(self):
        """Verify org_id is injected into the database session context."""
        app = FastAPI()

        # Note: Starlette middleware execution order is LIFO.
        # The middleware added LAST runs first (outermost).
        # We add OrgScopeMiddleware first, then fake_auth on top.
        app.add_middleware(OrgScopeMiddleware)

        @app.get("/api/v1/projects")
        async def list_projects(request: Request):
            org_id = get_current_org_id()
            return {"org_id": org_id}

        @app.middleware("http")
        async def fake_auth(request: Request, call_next):
            request.state.user_id = "user_123"
            request.state.org_id = "org_abc"
            request.state.user_org_ids = ["org_abc"]
            return await call_next(request)

        client = TestClient(app)
        response = client.get("/api/v1/projects")
        assert response.status_code == 200
        assert response.json()["org_id"] == "org_abc"

    def test_cleans_up_org_id_after_request(self):
        """Verify org_id context variable is cleaned up after request."""
        app = FastAPI()
        app.add_middleware(OrgScopeMiddleware)

        @app.get("/api/v1/projects")
        async def list_projects(request: Request):
            return {"org_id": get_current_org_id()}

        @app.middleware("http")
        async def fake_auth(request: Request, call_next):
            request.state.user_id = "user_123"
            request.state.org_id = "org_abc"
            request.state.user_org_ids = ["org_abc"]
            return await call_next(request)

        client = TestClient(app)
        client.get("/api/v1/projects")
        # After request completes, context should be cleared
        assert get_current_org_id() is None

    def test_cross_org_access_returns_404(self):
        """Verify cross-org access returns 404 (not 403) to hide resource existence."""
        app = FastAPI()
        app.add_middleware(OrgScopeMiddleware)

        @app.get("/api/v1/projects")
        async def list_projects(request: Request):
            return {"org_id": get_current_org_id()}

        @app.middleware("http")
        async def fake_auth(request: Request, call_next):
            # User belongs to org_abc but tries to access org_xyz
            request.state.user_id = "user_123"
            request.state.org_id = "org_xyz"  # target org
            request.state.user_org_ids = ["org_abc"]  # user's actual orgs
            return await call_next(request)

        client = TestClient(app)
        response = client.get("/api/v1/projects")
        assert response.status_code == 404
        assert response.json() == {"detail": "Not found"}

    def test_cross_org_access_does_not_return_403(self):
        """Verify cross-org access does NOT return 403 (would reveal existence)."""
        app = FastAPI()
        app.add_middleware(OrgScopeMiddleware)

        @app.get("/api/v1/projects")
        async def list_projects(request: Request):
            return {"org_id": get_current_org_id()}

        @app.middleware("http")
        async def fake_auth(request: Request, call_next):
            request.state.user_id = "user_123"
            request.state.org_id = "org_xyz"
            request.state.user_org_ids = ["org_abc"]
            return await call_next(request)

        client = TestClient(app)
        response = client.get("/api/v1/projects")
        # Must not be 403 - that would reveal the resource exists
        assert response.status_code != 403

    def test_cross_org_access_logged(self, caplog):
        """Verify cross-org access attempts are logged with required fields."""
        app = FastAPI()
        app.add_middleware(OrgScopeMiddleware)

        @app.get("/api/v1/projects")
        async def list_projects(request: Request):
            return {"org_id": get_current_org_id()}

        @app.middleware("http")
        async def fake_auth(request: Request, call_next):
            request.state.user_id = "user_attacker"
            request.state.org_id = "org_target"
            request.state.user_org_ids = ["org_attacker"]
            return await call_next(request)

        client = TestClient(app)
        with caplog.at_level(logging.WARNING):
            response = client.get("/api/v1/projects")

        assert response.status_code == 404
        # Check the log message exists
        assert any(
            "Cross-org access attempt" in record.message
            for record in caplog.records
        )

    def test_excluded_health_path_bypasses_middleware(self):
        """Verify health check paths bypass org scoping."""
        app = FastAPI()
        app.add_middleware(OrgScopeMiddleware)

        @app.get("/health")
        async def health():
            return {"status": "healthy"}

        client = TestClient(app)
        # No user context set - should still work for excluded paths
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

    def test_excluded_auth_paths_bypass_middleware(self):
        """Verify auth paths bypass org scoping."""
        app = FastAPI()
        app.add_middleware(OrgScopeMiddleware)

        @app.get("/api/v1/auth/login")
        async def auth_login():
            return {"status": "ok"}

        client = TestClient(app)
        response = client.get("/api/v1/auth/login")
        assert response.status_code == 200

    def test_excluded_webhook_paths_bypass_middleware(self):
        """Verify webhook paths bypass org scoping."""
        app = FastAPI()
        app.add_middleware(OrgScopeMiddleware)

        @app.get("/api/v1/webhooks/clerk")
        async def webhook():
            return {"status": "ok"}

        client = TestClient(app)
        response = client.get("/api/v1/webhooks/clerk")
        assert response.status_code == 200

    def test_unauthenticated_request_passes_through(self):
        """Verify requests without user context pass through (auth middleware handles)."""
        app = FastAPI()
        app.add_middleware(OrgScopeMiddleware)

        @app.get("/api/v1/projects")
        async def list_projects(request: Request):
            return {"status": "no_auth"}

        client = TestClient(app)
        response = client.get("/api/v1/projects")
        assert response.status_code == 200

    def test_no_org_id_passes_through(self):
        """Verify requests without org_id pass through (e.g., org creation flow)."""
        app = FastAPI()
        app.add_middleware(OrgScopeMiddleware)

        @app.get("/api/v1/organizations/create")
        async def create_org(request: Request):
            return {"status": "creating"}

        @app.middleware("http")
        async def fake_auth(request: Request, call_next):
            request.state.user_id = "user_123"
            request.state.org_id = None  # No org yet
            request.state.user_org_ids = []
            return await call_next(request)

        client = TestClient(app)
        response = client.get("/api/v1/organizations/create")
        assert response.status_code == 200

    def test_user_with_multiple_orgs_valid_access(self):
        """Verify user with multiple orgs can access one they belong to."""
        app = FastAPI()
        app.add_middleware(OrgScopeMiddleware)

        @app.get("/api/v1/projects")
        async def list_projects(request: Request):
            return {"org_id": get_current_org_id()}

        @app.middleware("http")
        async def fake_auth(request: Request, call_next):
            request.state.user_id = "user_123"
            request.state.org_id = "org_b"
            request.state.user_org_ids = ["org_a", "org_b", "org_c"]
            return await call_next(request)

        client = TestClient(app)
        response = client.get("/api/v1/projects")
        assert response.status_code == 200
        assert response.json()["org_id"] == "org_b"


class TestIsExcludedPath:
    """Test the _is_excluded_path helper function."""

    def test_health_path_excluded(self):
        assert _is_excluded_path("/health") is True

    def test_health_db_path_excluded(self):
        assert _is_excluded_path("/health/db") is True

    def test_docs_path_excluded(self):
        assert _is_excluded_path("/docs") is True

    def test_auth_prefix_excluded(self):
        assert _is_excluded_path("/api/v1/auth/login") is True
        assert _is_excluded_path("/api/v1/auth/signup") is True

    def test_webhook_prefix_excluded(self):
        assert _is_excluded_path("/api/v1/webhooks/clerk") is True
        assert _is_excluded_path("/api/v1/webhooks/stripe") is True

    def test_api_paths_not_excluded(self):
        assert _is_excluded_path("/api/v1/projects") is False
        assert _is_excluded_path("/api/v1/candidates") is False

    def test_root_path_not_excluded(self):
        assert _is_excluded_path("/") is False


class TestValidateResourceOrg:
    """Test the validate_resource_org utility function."""

    def test_matching_org_returns_true(self):
        """Verify matching org IDs returns True."""
        assert validate_resource_org("org_123", "org_123") is True

    def test_mismatched_org_returns_false(self):
        """Verify mismatched org IDs returns False."""
        assert validate_resource_org("org_123", "org_456") is False

    def test_none_resource_org_returns_false(self):
        """Verify None resource_org_id returns False."""
        assert validate_resource_org(None, "org_123") is False

    def test_none_request_org_returns_false(self):
        """Verify None request_org_id returns False."""
        assert validate_resource_org("org_123", None) is False

    def test_both_none_returns_false(self):
        """Verify both None returns False."""
        assert validate_resource_org(None, None) is False

    def test_cross_org_access_logged(self, caplog):
        """Verify cross-org resource access is logged with details."""
        with caplog.at_level(logging.WARNING):
            result = validate_resource_org(
                resource_org_id="org_victim",
                request_org_id="org_attacker",
                user_id="user_evil",
                resource_type="hiring_project",
                resource_id="proj_123",
            )

        assert result is False
        assert any(
            "Cross-org resource access" in record.message
            for record in caplog.records
        )

    def test_valid_access_not_logged(self, caplog):
        """Verify valid access does not generate warning logs."""
        with caplog.at_level(logging.WARNING):
            result = validate_resource_org(
                resource_org_id="org_same",
                request_org_id="org_same",
                user_id="user_123",
                resource_type="hiring_project",
                resource_id="proj_123",
            )

        assert result is True
        assert not any(
            "Cross-org" in record.message
            for record in caplog.records
        )
