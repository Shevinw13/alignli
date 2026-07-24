"""Tests for CSRF protection middleware."""

from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.core.middleware.csrf import (
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
    DEFAULT_EXEMPT_PATHS,
    CSRFMiddleware,
    generate_csrf_token,
    is_path_exempt,
)


def create_test_app(exempt_paths: Optional[list[str]] = None) -> FastAPI:
    """Create a minimal FastAPI app with CSRF middleware for testing."""
    app = FastAPI()
    app.add_middleware(
        CSRFMiddleware,
        exempt_paths=exempt_paths,
        cookie_secure=False,
        cookie_samesite="lax",
    )

    @app.get("/test")
    async def get_handler() -> dict[str, str]:
        return {"method": "GET"}

    @app.post("/test")
    async def post_handler() -> dict[str, str]:
        return {"method": "POST"}

    @app.put("/test")
    async def put_handler() -> dict[str, str]:
        return {"method": "PUT"}

    @app.patch("/test")
    async def patch_handler() -> dict[str, str]:
        return {"method": "PATCH"}

    @app.delete("/test")
    async def delete_handler() -> dict[str, str]:
        return {"method": "DELETE"}

    @app.post("/api/v1/webhooks/clerk")
    async def clerk_webhook() -> dict[str, str]:
        return {"webhook": "clerk"}

    @app.post("/api/v1/webhooks/stripe")
    async def stripe_webhook() -> dict[str, str]:
        return {"webhook": "stripe"}

    @app.post("/api/v1/webhooks/inngest")
    async def inngest_webhook() -> dict[str, str]:
        return {"webhook": "inngest"}

    return app


class TestGenerateCsrfToken:
    """Tests for CSRF token generation."""

    def test_generates_non_empty_token(self) -> None:
        """Token generation should produce a non-empty string."""
        token = generate_csrf_token()
        assert token
        assert isinstance(token, str)

    def test_generates_unique_tokens(self) -> None:
        """Each call should produce a different token."""
        tokens = {generate_csrf_token() for _ in range(100)}
        assert len(tokens) == 100

    def test_token_sufficient_length(self) -> None:
        """Token should be sufficiently long for security (at least 32 chars)."""
        token = generate_csrf_token()
        assert len(token) >= 32


class TestIsPathExempt:
    """Tests for path exemption checking."""

    def test_exempt_path_matches(self) -> None:
        """Exempt paths should be recognized."""
        assert is_path_exempt("/api/v1/webhooks/clerk", DEFAULT_EXEMPT_PATHS)
        assert is_path_exempt("/api/v1/webhooks/stripe", DEFAULT_EXEMPT_PATHS)
        assert is_path_exempt("/api/v1/webhooks/inngest", DEFAULT_EXEMPT_PATHS)

    def test_exempt_path_prefix_match(self) -> None:
        """Paths that start with exempt prefix should match."""
        assert is_path_exempt("/api/v1/webhooks/clerk/events", DEFAULT_EXEMPT_PATHS)

    def test_non_exempt_path(self) -> None:
        """Non-exempt paths should not match."""
        assert not is_path_exempt("/api/v1/projects", DEFAULT_EXEMPT_PATHS)
        assert not is_path_exempt("/test", DEFAULT_EXEMPT_PATHS)

    def test_empty_exempt_list(self) -> None:
        """Empty exempt list should never match."""
        assert not is_path_exempt("/api/v1/webhooks/clerk", [])


class TestCSRFMiddlewareSafeMethods:
    """Tests for CSRF middleware with safe HTTP methods."""

    def setup_method(self) -> None:
        """Set up test client."""
        self.app = create_test_app()
        self.client = TestClient(self.app)

    def test_get_passes_without_token(self) -> None:
        """GET requests should pass without CSRF token."""
        response = self.client.get("/test")
        assert response.status_code == 200
        assert response.json() == {"method": "GET"}

    def test_get_sets_csrf_cookie(self) -> None:
        """GET requests should set a CSRF cookie if not present."""
        response = self.client.get("/test")
        assert CSRF_COOKIE_NAME in response.cookies

    def test_head_passes_without_token(self) -> None:
        """HEAD requests should pass without CSRF token (not blocked by CSRF)."""
        response = self.client.head("/test")
        # HEAD may return 405 if no HEAD handler registered, but never 403
        assert response.status_code != 403

    def test_options_passes_without_token(self) -> None:
        """OPTIONS requests should pass without CSRF token."""
        response = self.client.options("/test")
        # FastAPI returns 405 for OPTIONS on routes without explicit handler,
        # but the middleware should not block it
        assert response.status_code != 403


class TestCSRFMiddlewareStateChangingMethods:
    """Tests for CSRF middleware with state-changing methods."""

    def setup_method(self) -> None:
        """Set up test client."""
        self.app = create_test_app()
        self.client = TestClient(self.app)

    def _get_csrf_token(self) -> str:
        """Get a CSRF token by making a GET request."""
        response = self.client.get("/test")
        return response.cookies.get(CSRF_COOKIE_NAME, "")

    def test_post_blocked_without_token(self) -> None:
        """POST requests should be blocked without CSRF token."""
        response = self.client.post("/test")
        assert response.status_code == 403
        error = response.json()["error"]
        assert error["code"] == "CSRF_VALIDATION_FAILED"
        assert error["message"] == "Invalid or missing CSRF token"

    def test_put_blocked_without_token(self) -> None:
        """PUT requests should be blocked without CSRF token."""
        response = self.client.put("/test")
        assert response.status_code == 403

    def test_patch_blocked_without_token(self) -> None:
        """PATCH requests should be blocked without CSRF token."""
        response = self.client.patch("/test")
        assert response.status_code == 403

    def test_delete_blocked_without_token(self) -> None:
        """DELETE requests should be blocked without CSRF token."""
        response = self.client.delete("/test")
        assert response.status_code == 403

    def test_post_passes_with_valid_token(self) -> None:
        """POST requests should pass with a valid CSRF token."""
        token = self._get_csrf_token()
        response = self.client.post(
            "/test",
            headers={CSRF_HEADER_NAME: token},
            cookies={CSRF_COOKIE_NAME: token},
        )
        assert response.status_code == 200
        assert response.json() == {"method": "POST"}

    def test_put_passes_with_valid_token(self) -> None:
        """PUT requests should pass with a valid CSRF token."""
        token = self._get_csrf_token()
        response = self.client.put(
            "/test",
            headers={CSRF_HEADER_NAME: token},
            cookies={CSRF_COOKIE_NAME: token},
        )
        assert response.status_code == 200
        assert response.json() == {"method": "PUT"}

    def test_patch_passes_with_valid_token(self) -> None:
        """PATCH requests should pass with a valid CSRF token."""
        token = self._get_csrf_token()
        response = self.client.patch(
            "/test",
            headers={CSRF_HEADER_NAME: token},
            cookies={CSRF_COOKIE_NAME: token},
        )
        assert response.status_code == 200
        assert response.json() == {"method": "PATCH"}

    def test_delete_passes_with_valid_token(self) -> None:
        """DELETE requests should pass with a valid CSRF token."""
        token = self._get_csrf_token()
        response = self.client.delete(
            "/test",
            headers={CSRF_HEADER_NAME: token},
            cookies={CSRF_COOKIE_NAME: token},
        )
        assert response.status_code == 200
        assert response.json() == {"method": "DELETE"}

    def test_post_blocked_with_mismatched_token(self) -> None:
        """POST should be blocked if header token doesn't match cookie."""
        token = self._get_csrf_token()
        response = self.client.post(
            "/test",
            headers={CSRF_HEADER_NAME: "wrong-token"},
            cookies={CSRF_COOKIE_NAME: token},
        )
        assert response.status_code == 403

    def test_post_blocked_with_header_only(self) -> None:
        """POST should be blocked if only header is present (no cookie)."""
        response = self.client.post(
            "/test",
            headers={CSRF_HEADER_NAME: "some-token"},
        )
        assert response.status_code == 403

    def test_post_blocked_with_cookie_only(self) -> None:
        """POST should be blocked if only cookie is present (no header)."""
        token = self._get_csrf_token()
        response = self.client.post(
            "/test",
            cookies={CSRF_COOKIE_NAME: token},
        )
        assert response.status_code == 403


class TestCSRFMiddlewareExemptPaths:
    """Tests for CSRF middleware path exemptions."""

    def setup_method(self) -> None:
        """Set up test client."""
        self.app = create_test_app()
        self.client = TestClient(self.app)

    def test_clerk_webhook_exempt(self) -> None:
        """Clerk webhook path should bypass CSRF validation."""
        response = self.client.post("/api/v1/webhooks/clerk")
        assert response.status_code == 200
        assert response.json() == {"webhook": "clerk"}

    def test_stripe_webhook_exempt(self) -> None:
        """Stripe webhook path should bypass CSRF validation."""
        response = self.client.post("/api/v1/webhooks/stripe")
        assert response.status_code == 200
        assert response.json() == {"webhook": "stripe"}

    def test_inngest_webhook_exempt(self) -> None:
        """Inngest webhook path should bypass CSRF validation."""
        response = self.client.post("/api/v1/webhooks/inngest")
        assert response.status_code == 200
        assert response.json() == {"webhook": "inngest"}

    def test_custom_exempt_paths(self) -> None:
        """Custom exempt paths should be respected."""
        app = create_test_app(exempt_paths=["/custom/exempt"])

        @app.post("/custom/exempt")
        async def custom_exempt() -> dict[str, str]:
            return {"exempt": "true"}

        client = TestClient(app)
        response = client.post("/custom/exempt")
        assert response.status_code == 200


class TestCSRFTokenEndpoint:
    """Tests for the GET /api/v1/csrf-token endpoint."""

    def setup_method(self) -> None:
        """Set up test client using the main app."""
        from app.main import app

        self.client = TestClient(app)

    def test_returns_csrf_token(self) -> None:
        """CSRF token endpoint should return a token in the response body."""
        response = self.client.get("/api/v1/csrf-token")
        assert response.status_code == 200
        data = response.json()
        assert "csrf_token" in data
        assert isinstance(data["csrf_token"], str)
        assert len(data["csrf_token"]) >= 32

    def test_sets_csrf_cookie(self) -> None:
        """CSRF token endpoint should set the csrf_token cookie."""
        response = self.client.get("/api/v1/csrf-token")
        assert CSRF_COOKIE_NAME in response.cookies

    def test_cookie_matches_body(self) -> None:
        """The cookie value should match the token in the response body."""
        response = self.client.get("/api/v1/csrf-token")
        body_token = response.json()["csrf_token"]
        cookie_token = response.cookies[CSRF_COOKIE_NAME]
        assert body_token == cookie_token

    def test_different_tokens_on_each_call(self) -> None:
        """Each call should generate a fresh token."""
        response1 = self.client.get("/api/v1/csrf-token")
        response2 = self.client.get("/api/v1/csrf-token")
        assert response1.json()["csrf_token"] != response2.json()["csrf_token"]
