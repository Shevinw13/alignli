"""CSRF protection middleware using Double Submit Cookie pattern.

Validates CSRF tokens on all state-changing requests (POST, PUT, PATCH, DELETE).
GET, HEAD, and OPTIONS requests pass through without CSRF validation.

Pattern:
- A CSRF token is generated and set as a cookie.
- The frontend reads the cookie and sends the token in the X-CSRF-Token header.
- The middleware validates that the header value matches the cookie value.
"""

from __future__ import annotations

import secrets
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

# Methods that require CSRF validation
STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Methods that are exempt from CSRF validation
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

# Header name for CSRF token submission
CSRF_HEADER_NAME = "x-csrf-token"

# Cookie name for CSRF token
CSRF_COOKIE_NAME = "csrf_token"

# Default exempt paths (webhooks from external services)
DEFAULT_EXEMPT_PATHS: list[str] = [
    "/api/v1/",  # All API routes use Bearer token auth instead of CSRF
    "/api/v1/webhooks/clerk",
    "/api/v1/webhooks/stripe",
    "/api/v1/webhooks/inngest",
]


def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token.

    Uses the secrets module which provides cryptographically strong
    random values suitable for managing security tokens.
    """
    return secrets.token_urlsafe(32)


def is_path_exempt(path: str, exempt_paths: list[str]) -> bool:
    """Check if the request path is exempt from CSRF validation.

    Args:
        path: The request URL path.
        exempt_paths: List of path prefixes that are exempt.

    Returns:
        True if the path is exempt from CSRF validation.
    """
    return any(path.startswith(exempt_path) for exempt_path in exempt_paths)


class CSRFMiddleware(BaseHTTPMiddleware):
    """CSRF protection middleware using Double Submit Cookie pattern.

    Validates that state-changing requests include a valid CSRF token
    in the X-CSRF-Token header that matches the csrf_token cookie.
    """

    def __init__(
        self,
        app: object,
        exempt_paths: list[str] | None = None,
        cookie_secure: bool = True,
        cookie_samesite: str = "lax",
    ) -> None:
        """Initialize CSRF middleware.

        Args:
            app: The ASGI application.
            exempt_paths: Additional paths to exempt from CSRF validation.
            cookie_secure: Whether to set the Secure flag on the cookie.
            cookie_samesite: SameSite attribute for the cookie.
        """
        super().__init__(app)
        self.exempt_paths = DEFAULT_EXEMPT_PATHS.copy()
        if exempt_paths:
            self.exempt_paths.extend(exempt_paths)
        self.cookie_secure = cookie_secure
        self.cookie_samesite = cookie_samesite

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Process the request and validate CSRF token if needed.

        Args:
            request: The incoming HTTP request.
            call_next: The next middleware or route handler.

        Returns:
            The response from the next handler or a 403 error response.
        """
        # Safe methods pass through without CSRF check
        if request.method in SAFE_METHODS:
            response = await call_next(request)
            return self._ensure_csrf_cookie(request, response)

        # Exempt paths pass through without CSRF check
        if is_path_exempt(request.url.path, self.exempt_paths):
            return await call_next(request)

        # Validate CSRF token for state-changing requests
        cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
        header_token = request.headers.get(CSRF_HEADER_NAME)

        if not cookie_token or not header_token:
            return self._csrf_error_response()

        if not secrets.compare_digest(cookie_token, header_token):
            return self._csrf_error_response()

        # Token is valid, proceed with the request
        response = await call_next(request)
        return response

    def _ensure_csrf_cookie(self, request: Request, response: Response) -> Response:
        """Ensure the CSRF cookie is set on safe method responses.

        If the client doesn't already have a CSRF cookie and the response
        hasn't already set one, generate one and set it on the response.

        Args:
            request: The incoming HTTP request.
            response: The response to potentially add the cookie to.

        Returns:
            The response with the CSRF cookie set if needed.
        """
        # Don't set cookie if the request already has one
        if request.cookies.get(CSRF_COOKIE_NAME):
            return response

        # Don't overwrite if the response already sets this cookie
        # (e.g., the csrf-token endpoint sets it explicitly)
        for header_name, header_value in response.raw_headers:
            if header_name == b"set-cookie" and CSRF_COOKIE_NAME.encode() in header_value:
                return response

        token = generate_csrf_token()
        response.set_cookie(
            key=CSRF_COOKIE_NAME,
            value=token,
            httponly=False,  # Frontend needs to read this cookie
            secure=self.cookie_secure,
            samesite=self.cookie_samesite,
            path="/",
        )
        return response

    def _csrf_error_response(self) -> JSONResponse:
        """Return a 403 response for CSRF validation failures.

        Returns:
            JSONResponse with CSRF error details.
        """
        return JSONResponse(
            status_code=403,
            content={
                "error": {
                    "code": "CSRF_VALIDATION_FAILED",
                    "message": "Invalid or missing CSRF token",
                }
            },
        )
