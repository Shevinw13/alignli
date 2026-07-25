"""Property-based tests for rate limiting and CSRF protection.

These tests verify security middleware behavior under randomized inputs:
- Property 24: Rate Limiting Enforcement — requests exceeding threshold are rejected with retry-after
- Property 25: CSRF Protection on State-Changing Requests — requests without valid CSRF token are rejected

Validates: Requirements 18.3, 18.4, 18.8
"""

from __future__ import annotations

from unittest.mock import patch

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.middleware.csrf import (
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
    CSRFMiddleware,
    STATE_CHANGING_METHODS,
    SAFE_METHODS,
    DEFAULT_EXEMPT_PATHS,
    generate_csrf_token,
)
from app.core.middleware.rate_limit import (
    RateLimitMiddleware,
    SlidingWindowCounter,
    get_rate_limit_store,
)


# --- Strategies ---

# Rate limit thresholds: realistic values between 1 and 200
rate_limit_threshold = st.integers(min_value=1, max_value=50)

# Number of requests to make: between 1 and 100
request_count = st.integers(min_value=1, max_value=80)

# Client identifiers (IP addresses or user IDs)
client_id_strategy = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="._-"),
    min_size=3,
    max_size=30,
).filter(lambda s: len(s.strip()) >= 3)

# State-changing HTTP methods
state_changing_method_strategy = st.sampled_from(["POST", "PUT", "PATCH", "DELETE"])

# Safe HTTP methods
safe_method_strategy = st.sampled_from(["GET", "HEAD", "OPTIONS"])

# CSRF token strategy: ASCII-safe non-empty strings for crafted tokens
# HTTP headers require ASCII encoding, so we restrict to printable ASCII
csrf_token_strategy = st.text(
    alphabet=st.characters(
        min_codepoint=33,  # exclude control chars and space
        max_codepoint=126,  # printable ASCII only
        blacklist_characters=";,\"",  # avoid cookie/header delimiters
    ),
    min_size=1,
    max_size=64,
)

# API paths (non-exempt paths for CSRF testing)
non_exempt_path_strategy = st.sampled_from([
    "/api/v1/projects",
    "/api/v1/candidates",
    "/api/v1/settings",
    "/test",
    "/api/v1/communication",
])


# --- Helpers ---


class FakeAuthMiddleware(BaseHTTPMiddleware):
    """Middleware that simulates authentication by setting user_id on request state."""

    def __init__(self, app: FastAPI, user_id: str | None = None) -> None:
        super().__init__(app)
        self.user_id = user_id

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if self.user_id:
            request.state.user_id = self.user_id
        response = await call_next(request)
        return response


def _create_rate_limit_app(
    authenticated_limit: int = 100,
    unauthenticated_limit: int = 20,
    user_id: str | None = None,
) -> FastAPI:
    """Create a minimal FastAPI app with rate limiting middleware for property testing."""
    app = FastAPI()

    @app.get("/test")
    async def test_endpoint() -> dict[str, str]:
        return {"message": "ok"}

    @app.post("/test")
    async def test_post() -> dict[str, str]:
        return {"message": "ok"}

    app.add_middleware(RateLimitMiddleware)

    if user_id:
        app.add_middleware(FakeAuthMiddleware, user_id=user_id)

    return app


def _create_csrf_app(exempt_paths: list[str] | None = None) -> FastAPI:
    """Create a minimal FastAPI app with CSRF middleware for property testing."""
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

    @app.api_route(
        "/api/v1/projects",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    )
    async def projects_handler() -> dict[str, str]:
        return {"resource": "projects"}

    @app.api_route(
        "/api/v1/candidates",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    )
    async def candidates_handler() -> dict[str, str]:
        return {"resource": "candidates"}

    @app.api_route(
        "/api/v1/settings",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    )
    async def settings_handler() -> dict[str, str]:
        return {"resource": "settings"}

    @app.api_route(
        "/api/v1/communication",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    )
    async def communication_handler() -> dict[str, str]:
        return {"resource": "communication"}

    return app


# --- Property 24: Rate Limiting Enforcement ---


class TestRateLimitingEnforcement:
    """Property 24: Rate Limiting Enforcement.

    For any client making requests to the API, when the number of requests exceeds
    the configured threshold within the time window, subsequent requests SHALL be
    rejected with HTTP 429 status and a Retry-After header indicating when the
    client may retry.

    **Validates: Requirements 18.3, 18.4**
    """

    @given(
        max_requests=rate_limit_threshold,
        client_key=client_id_strategy,
    )
    @settings(max_examples=100)
    def test_requests_exceeding_threshold_are_rejected(
        self,
        max_requests: int,
        client_key: str,
    ):
        """Requests beyond the configured limit are always rejected with 429.

        For any threshold N and any client identifier, after N requests within
        the sliding window, the (N+1)th request must be rejected.

        **Validates: Requirements 18.3, 18.4**
        """
        counter = SlidingWindowCounter(window_seconds=60)

        # Make exactly max_requests successful requests
        for _ in range(max_requests):
            is_limited, retry_after = counter.is_rate_limited(client_key, max_requests)
            assert is_limited is False
            assert retry_after == 0

        # The next request must be rejected
        is_limited, retry_after = counter.is_rate_limited(client_key, max_requests)
        assert is_limited is True
        assert retry_after >= 1

    @given(
        max_requests=rate_limit_threshold,
        client_key=client_id_strategy,
        extra_requests=st.integers(min_value=1, max_value=20),
    )
    @settings(max_examples=100)
    def test_all_requests_beyond_threshold_remain_rejected(
        self,
        max_requests: int,
        client_key: str,
        extra_requests: int,
    ):
        """Once rate limited, all subsequent requests in the window are also rejected.

        The system must not intermittently allow requests once the threshold is reached.

        **Validates: Requirements 18.3, 18.4**
        """
        counter = SlidingWindowCounter(window_seconds=60)

        # Exhaust the limit
        for _ in range(max_requests):
            counter.is_rate_limited(client_key, max_requests)

        # All further requests must be rejected
        for _ in range(extra_requests):
            is_limited, retry_after = counter.is_rate_limited(client_key, max_requests)
            assert is_limited is True
            assert retry_after >= 1

    @given(
        max_requests=rate_limit_threshold,
        num_requests=request_count,
        client_key=client_id_strategy,
    )
    @settings(max_examples=100)
    def test_retry_after_always_positive_when_limited(
        self,
        max_requests: int,
        num_requests: int,
        client_key: str,
    ):
        """When rate limited, the retry-after value is always a positive integer >= 1.

        **Validates: Requirements 18.4**
        """
        counter = SlidingWindowCounter(window_seconds=60)

        for i in range(num_requests):
            is_limited, retry_after = counter.is_rate_limited(client_key, max_requests)
            if is_limited:
                assert retry_after >= 1
                assert isinstance(retry_after, int)

    @given(
        max_requests=st.integers(min_value=2, max_value=20),
    )
    @settings(max_examples=50)
    def test_rate_limit_middleware_returns_429_with_retry_after_header(
        self,
        max_requests: int,
    ):
        """The HTTP middleware response includes 429 status and Retry-After header.

        This tests the full middleware integration, verifying that the rate limiter
        correctly translates the SlidingWindowCounter rejection into a proper HTTP
        response with the required headers.

        **Validates: Requirements 18.3, 18.4**
        """
        get_rate_limit_store().reset()

        with patch("app.core.middleware.rate_limit.get_settings") as mock_settings:
            mock_settings.return_value.rate_limit_authenticated = 100
            mock_settings.return_value.rate_limit_unauthenticated = max_requests

            app = _create_rate_limit_app(unauthenticated_limit=max_requests)
            client = TestClient(app)

            # Exhaust the limit
            for _ in range(max_requests):
                resp = client.get("/test")
                assert resp.status_code == 200

            # Next request must be 429 with Retry-After header
            response = client.get("/test")
            assert response.status_code == 429
            assert "retry-after" in response.headers
            retry_after_value = int(response.headers["retry-after"])
            assert retry_after_value >= 1

            # Response body must contain structured error
            body = response.json()
            assert body["error"]["code"] == "RATE_LIMITED"
            assert "retry_after" in body["error"]["details"][0]
            assert body["error"]["details"][0]["retry_after"] >= 1

    @given(
        max_requests=rate_limit_threshold,
        key_a=client_id_strategy,
        key_b=client_id_strategy,
    )
    @settings(max_examples=100)
    def test_rate_limits_are_independent_per_client(
        self,
        max_requests: int,
        key_a: str,
        key_b: str,
    ):
        """Rate limiting for one client does not affect another client.

        Each client (user or IP) has independent rate counters.

        **Validates: Requirements 18.3**
        """
        assume(key_a != key_b)
        counter = SlidingWindowCounter(window_seconds=60)

        # Exhaust key_a's limit
        for _ in range(max_requests):
            counter.is_rate_limited(key_a, max_requests)

        # key_a must be limited
        is_limited_a, _ = counter.is_rate_limited(key_a, max_requests)
        assert is_limited_a is True

        # key_b must NOT be limited
        is_limited_b, _ = counter.is_rate_limited(key_b, max_requests)
        assert is_limited_b is False


# --- Property 25: CSRF Protection on State-Changing Requests ---


class TestCSRFProtectionOnStateChangingRequests:
    """Property 25: CSRF Protection on State-Changing Requests.

    For any state-changing HTTP request (POST, PUT, PATCH, DELETE), if the request
    does not include a valid CSRF token (matching header and cookie), the system
    SHALL reject the request with HTTP 403 and an error indicating CSRF validation
    failure.

    **Validates: Requirements 18.8**
    """

    @given(method=state_changing_method_strategy)
    @settings(max_examples=50)
    def test_state_changing_request_without_any_token_is_rejected(
        self,
        method: str,
    ):
        """State-changing requests without any CSRF token are always rejected with 403.

        **Validates: Requirements 18.8**
        """
        app = _create_csrf_app()
        client = TestClient(app)

        response = client.request(method, "/test")

        assert response.status_code == 403
        body = response.json()
        assert body["error"]["code"] == "CSRF_VALIDATION_FAILED"
        assert "token" in body["error"]["message"].lower() or "csrf" in body["error"]["message"].lower()

    @given(
        method=state_changing_method_strategy,
        fake_header_token=csrf_token_strategy,
    )
    @settings(max_examples=100)
    def test_state_changing_request_with_header_only_is_rejected(
        self,
        method: str,
        fake_header_token: str,
    ):
        """State-changing requests with only header token (no cookie) are rejected.

        The Double Submit Cookie pattern requires both cookie and header to match.

        **Validates: Requirements 18.8**
        """
        app = _create_csrf_app()
        client = TestClient(app)

        response = client.request(
            method,
            "/test",
            headers={CSRF_HEADER_NAME: fake_header_token},
        )

        assert response.status_code == 403

    @given(
        method=state_changing_method_strategy,
        fake_cookie_token=csrf_token_strategy,
    )
    @settings(max_examples=100)
    def test_state_changing_request_with_cookie_only_is_rejected(
        self,
        method: str,
        fake_cookie_token: str,
    ):
        """State-changing requests with only cookie token (no header) are rejected.

        The Double Submit Cookie pattern requires the frontend to explicitly
        copy the cookie value into the request header.

        **Validates: Requirements 18.8**
        """
        app = _create_csrf_app()
        client = TestClient(app)

        response = client.request(
            method,
            "/test",
            cookies={CSRF_COOKIE_NAME: fake_cookie_token},
        )

        assert response.status_code == 403

    @given(
        method=state_changing_method_strategy,
        cookie_token=csrf_token_strategy,
        header_token=csrf_token_strategy,
    )
    @settings(max_examples=100)
    def test_state_changing_request_with_mismatched_tokens_is_rejected(
        self,
        method: str,
        cookie_token: str,
        header_token: str,
    ):
        """State-changing requests where header token != cookie token are rejected.

        An attacker cannot forge the header value to match an unknown cookie.

        **Validates: Requirements 18.8**
        """
        assume(cookie_token != header_token)

        app = _create_csrf_app()
        client = TestClient(app)

        response = client.request(
            method,
            "/test",
            headers={CSRF_HEADER_NAME: header_token},
            cookies={CSRF_COOKIE_NAME: cookie_token},
        )

        assert response.status_code == 403

    @given(
        method=state_changing_method_strategy,
        path=non_exempt_path_strategy,
    )
    @settings(max_examples=50)
    def test_csrf_rejection_consistent_across_paths_and_methods(
        self,
        method: str,
        path: str,
    ):
        """CSRF protection applies uniformly to all state-changing methods and non-exempt paths.

        **Validates: Requirements 18.8**
        """
        app = _create_csrf_app()
        client = TestClient(app)

        response = client.request(method, path)

        assert response.status_code == 403
        body = response.json()
        assert body["error"]["code"] == "CSRF_VALIDATION_FAILED"

    @given(method=state_changing_method_strategy)
    @settings(max_examples=50)
    def test_state_changing_request_with_matching_tokens_is_allowed(
        self,
        method: str,
    ):
        """State-changing requests with valid matching tokens pass CSRF validation.

        This confirms the positive case: when both cookie and header contain the
        same token, the middleware allows the request through.

        **Validates: Requirements 18.8**
        """
        app = _create_csrf_app()
        client = TestClient(app)

        # Get a valid token from the middleware
        get_response = client.get("/test")
        token = get_response.cookies.get(CSRF_COOKIE_NAME, "")
        assert token, "CSRF cookie should be set on GET requests"

        # Use matching token in both cookie and header
        response = client.request(
            method,
            "/test",
            headers={CSRF_HEADER_NAME: token},
            cookies={CSRF_COOKIE_NAME: token},
        )

        assert response.status_code == 200

    @given(method=safe_method_strategy)
    @settings(max_examples=30)
    def test_safe_methods_pass_without_csrf_token(
        self,
        method: str,
    ):
        """Safe methods (GET, HEAD, OPTIONS) are never blocked by CSRF validation.

        This confirms the middleware only enforces CSRF on state-changing requests.

        **Validates: Requirements 18.8**
        """
        app = _create_csrf_app()
        client = TestClient(app)

        response = client.request(method, "/test")

        # Should never get 403 for safe methods
        assert response.status_code != 403
