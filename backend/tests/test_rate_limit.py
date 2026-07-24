"""Tests for rate limiting middleware."""

from __future__ import annotations

import time
from unittest.mock import patch

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.middleware.rate_limit import (
    RateLimitMiddleware,
    SlidingWindowCounter,
    get_rate_limit_store,
)


# --- Unit tests for SlidingWindowCounter ---


class TestSlidingWindowCounter:
    """Tests for the sliding window counter logic."""

    def test_allows_requests_under_limit(self) -> None:
        """Requests within the limit should not be rate limited."""
        counter = SlidingWindowCounter(window_seconds=60)
        for _ in range(5):
            is_limited, retry_after = counter.is_rate_limited("test_key", max_requests=10)
            assert is_limited is False
            assert retry_after == 0

    def test_blocks_requests_at_limit(self) -> None:
        """Requests at the limit should be blocked."""
        counter = SlidingWindowCounter(window_seconds=60)
        # Fill up to the limit
        for _ in range(3):
            is_limited, _ = counter.is_rate_limited("test_key", max_requests=3)
            assert is_limited is False

        # Next request should be blocked
        is_limited, retry_after = counter.is_rate_limited("test_key", max_requests=3)
        assert is_limited is True
        assert retry_after >= 1

    def test_separate_keys_have_independent_limits(self) -> None:
        """Different keys should have independent rate limit counters."""
        counter = SlidingWindowCounter(window_seconds=60)
        # Fill up key_a
        for _ in range(3):
            counter.is_rate_limited("key_a", max_requests=3)

        # key_a should be limited
        is_limited_a, _ = counter.is_rate_limited("key_a", max_requests=3)
        assert is_limited_a is True

        # key_b should still be allowed
        is_limited_b, _ = counter.is_rate_limited("key_b", max_requests=3)
        assert is_limited_b is False

    def test_expired_entries_are_cleaned_up(self) -> None:
        """Entries older than the window should be removed."""
        counter = SlidingWindowCounter(window_seconds=1)

        # Fill up to the limit
        for _ in range(3):
            counter.is_rate_limited("test_key", max_requests=3)

        # Should be limited now
        is_limited, _ = counter.is_rate_limited("test_key", max_requests=3)
        assert is_limited is True

        # Wait for window to expire
        time.sleep(1.1)

        # Should be allowed again
        is_limited, _ = counter.is_rate_limited("test_key", max_requests=3)
        assert is_limited is False

    def test_reset_clears_all_data(self) -> None:
        """Reset should clear all stored request data."""
        counter = SlidingWindowCounter(window_seconds=60)
        for _ in range(5):
            counter.is_rate_limited("test_key", max_requests=5)

        # Should be limited
        is_limited, _ = counter.is_rate_limited("test_key", max_requests=5)
        assert is_limited is True

        counter.reset()

        # Should be allowed after reset
        is_limited, _ = counter.is_rate_limited("test_key", max_requests=5)
        assert is_limited is False

    def test_retry_after_is_at_least_one(self) -> None:
        """retry_after should always be at least 1 second."""
        counter = SlidingWindowCounter(window_seconds=60)
        for _ in range(2):
            counter.is_rate_limited("test_key", max_requests=2)

        is_limited, retry_after = counter.is_rate_limited("test_key", max_requests=2)
        assert is_limited is True
        assert retry_after >= 1


# --- Integration tests for RateLimitMiddleware ---


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


def create_test_app(
    authenticated_limit: int = 100,
    unauthenticated_limit: int = 20,
    user_id: str | None = None,
) -> FastAPI:
    """Create a test app with rate limiting middleware."""
    app = FastAPI()

    @app.get("/test")
    async def test_endpoint() -> dict[str, str]:
        return {"message": "ok"}

    # Add rate limit middleware
    # Note: In Starlette, middlewares execute in reverse order of add_middleware calls
    # So we add auth first, then rate limit, so rate limit runs after auth sets user_id
    app.add_middleware(RateLimitMiddleware)

    if user_id:
        app.add_middleware(FakeAuthMiddleware, user_id=user_id)

    return app


class TestRateLimitMiddleware:
    """Integration tests for the rate limiting middleware."""

    def setup_method(self) -> None:
        """Reset the global rate limit store before each test."""
        get_rate_limit_store().reset()

    def test_unauthenticated_requests_limited_at_20(self) -> None:
        """Unauthenticated requests should be limited at 20 per minute."""
        with patch("app.core.middleware.rate_limit.get_settings") as mock_settings:
            mock_settings.return_value.rate_limit_authenticated = 100
            mock_settings.return_value.rate_limit_unauthenticated = 5  # Lower for test speed

            app = create_test_app(unauthenticated_limit=5)
            client = TestClient(app)

            # First 5 requests should succeed
            for _ in range(5):
                response = client.get("/test")
                assert response.status_code == 200

            # 6th request should be rate limited
            response = client.get("/test")
            assert response.status_code == 429

    def test_authenticated_requests_limited_at_100(self) -> None:
        """Authenticated requests should be limited at 100 per minute."""
        with patch("app.core.middleware.rate_limit.get_settings") as mock_settings:
            mock_settings.return_value.rate_limit_authenticated = 5  # Lower for test speed
            mock_settings.return_value.rate_limit_unauthenticated = 20

            app = create_test_app(authenticated_limit=5, user_id="user_123")
            client = TestClient(app)

            # First 5 requests should succeed
            for _ in range(5):
                response = client.get("/test")
                assert response.status_code == 200

            # 6th request should be rate limited
            response = client.get("/test")
            assert response.status_code == 429

    def test_rate_limit_response_format(self) -> None:
        """Rate limited response should have proper JSON format and headers."""
        with patch("app.core.middleware.rate_limit.get_settings") as mock_settings:
            mock_settings.return_value.rate_limit_authenticated = 100
            mock_settings.return_value.rate_limit_unauthenticated = 2

            app = create_test_app(unauthenticated_limit=2)
            client = TestClient(app)

            # Exhaust the limit
            for _ in range(2):
                client.get("/test")

            # Check the rate-limited response
            response = client.get("/test")
            assert response.status_code == 429

            body = response.json()
            assert body["error"]["code"] == "RATE_LIMITED"
            assert body["error"]["message"] == "Rate limit exceeded"
            assert len(body["error"]["details"]) == 1
            assert "retry_after" in body["error"]["details"][0]
            assert body["error"]["details"][0]["retry_after"] >= 1

            # Check Retry-After header
            assert "retry-after" in response.headers
            assert int(response.headers["retry-after"]) >= 1

    def test_different_users_have_separate_limits(self) -> None:
        """Different authenticated users should have independent limits."""
        get_rate_limit_store().reset()

        with patch("app.core.middleware.rate_limit.get_settings") as mock_settings:
            mock_settings.return_value.rate_limit_authenticated = 2
            mock_settings.return_value.rate_limit_unauthenticated = 20

            # Create app for user_a
            app_a = create_test_app(authenticated_limit=2, user_id="user_a")
            client_a = TestClient(app_a)

            # Exhaust user_a's limit
            for _ in range(2):
                client_a.get("/test")

            # user_a should be limited
            response = client_a.get("/test")
            assert response.status_code == 429

            # Create app for user_b (fresh store since we test with same global)
            # user_b should NOT be limited since we key by user_id
            app_b = create_test_app(authenticated_limit=2, user_id="user_b")
            client_b = TestClient(app_b)

            response = client_b.get("/test")
            assert response.status_code == 200

    def test_x_forwarded_for_used_for_ip(self) -> None:
        """X-Forwarded-For header should be used for IP-based rate limiting."""
        with patch("app.core.middleware.rate_limit.get_settings") as mock_settings:
            mock_settings.return_value.rate_limit_authenticated = 100
            mock_settings.return_value.rate_limit_unauthenticated = 2

            app = create_test_app(unauthenticated_limit=2)
            client = TestClient(app)

            # Exhaust limit for IP 1.2.3.4
            for _ in range(2):
                client.get("/test", headers={"X-Forwarded-For": "1.2.3.4"})

            # 1.2.3.4 should be limited
            response = client.get("/test", headers={"X-Forwarded-For": "1.2.3.4"})
            assert response.status_code == 429

            # Different IP should not be limited
            response = client.get("/test", headers={"X-Forwarded-For": "5.6.7.8"})
            assert response.status_code == 200
