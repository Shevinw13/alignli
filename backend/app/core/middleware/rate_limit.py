"""Rate limiting middleware using sliding window algorithm.

Implements per-user (authenticated) and per-IP (unauthenticated) rate limiting.
Uses an in-memory store suitable for single-instance MVP deployment.
Can be upgraded to Redis-backed store for horizontal scaling.
"""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

from app.core.config import get_settings


class SlidingWindowCounter:
    """In-memory sliding window rate limiter.

    Tracks request timestamps per key within a sliding window.
    Expired entries are cleaned up on each check.
    """

    def __init__(self, window_seconds: int = 60) -> None:
        self.window_seconds = window_seconds
        # key -> list of timestamps
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_rate_limited(self, key: str, max_requests: int) -> tuple[bool, int]:
        """Check if the key has exceeded the rate limit.

        Args:
            key: Identifier for the client (user_id or IP).
            max_requests: Maximum allowed requests in the window.

        Returns:
            Tuple of (is_limited, retry_after_seconds).
            retry_after_seconds is 0 if not limited.
        """
        now = time.time()
        window_start = now - self.window_seconds

        # Remove expired entries
        self._requests[key] = [
            ts for ts in self._requests[key] if ts > window_start
        ]

        if len(self._requests[key]) >= max_requests:
            # Calculate retry-after: time until the oldest request in window expires
            oldest_in_window = self._requests[key][0]
            retry_after = int(oldest_in_window - window_start) + 1
            # Ensure retry_after is at least 1 second
            retry_after = max(retry_after, 1)
            return True, retry_after

        # Record this request
        self._requests[key].append(now)
        return False, 0

    def reset(self) -> None:
        """Clear all stored request data. Useful for testing."""
        self._requests.clear()


# Module-level store instance shared across requests
_rate_limit_store = SlidingWindowCounter(window_seconds=60)


def get_rate_limit_store() -> SlidingWindowCounter:
    """Get the global rate limit store instance."""
    return _rate_limit_store


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware for FastAPI.

    Applies different limits for authenticated vs unauthenticated requests:
    - Authenticated users: keyed by user_id, higher limit
    - Unauthenticated requests: keyed by client IP, lower limit
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        settings = get_settings()
        self.authenticated_limit = settings.rate_limit_authenticated
        self.unauthenticated_limit = settings.rate_limit_unauthenticated
        self.store = get_rate_limit_store()

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process the request and apply rate limiting."""
        # Determine if the request is authenticated and get the appropriate key
        user_id = self._get_user_id(request)

        if user_id:
            key = f"user:{user_id}"
            max_requests = self.authenticated_limit
        else:
            client_ip = self._get_client_ip(request)
            key = f"ip:{client_ip}"
            max_requests = self.unauthenticated_limit

        is_limited, retry_after = self.store.is_rate_limited(key, max_requests)

        if is_limited:
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": "Rate limit exceeded",
                        "details": [{"retry_after": retry_after}],
                    }
                },
                headers={"Retry-After": str(retry_after)},
            )

        response = await call_next(request)
        return response

    def _get_user_id(self, request: Request) -> str | None:
        """Extract user ID from request state if authenticated.

        The auth middleware (when present) sets request.state.user_id
        for authenticated requests.
        """
        return getattr(request.state, "user_id", None)

    def _get_client_ip(self, request: Request) -> str:
        """Get the client's IP address, respecting X-Forwarded-For header."""
        # Check for forwarded IP (behind proxy/load balancer)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Take the first IP in the chain (original client)
            return forwarded_for.split(",")[0].strip()

        # Fall back to direct client IP
        if request.client:
            return request.client.host

        return "unknown"
