"""Global exception handling with consistent error response format.

Provides custom application exceptions and a global exception handler that
returns structured error responses.

Requirements: 18.2

Error Response Format:
{
    "error": {
        "code": "ERROR_CODE",
        "message": "Human-readable error description",
        "details": [{"field": "name", "message": "Field-specific error"}]
    }
}
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError

logger = logging.getLogger(__name__)


# --- Error Response Helpers ---


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: list[dict[str, str]] | None = None,
) -> JSONResponse:
    """Create a standardized error JSON response."""
    body: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    if details:
        body["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=body)


# --- Custom Application Exceptions ---


class AppException(Exception):
    """Base application exception with HTTP status code and error code."""

    status_code: int = 500
    code: str = "INTERNAL_ERROR"
    message: str = "An unexpected error occurred"

    def __init__(
        self,
        message: str | None = None,
        details: list[dict[str, str]] | None = None,
    ) -> None:
        self.message = message or self.__class__.message
        self.details = details
        super().__init__(self.message)


class ValidationException(AppException):
    """Input validation failed (400)."""

    status_code = 400
    code = "VALIDATION_ERROR"
    message = "Validation failed"


class UnauthorizedException(AppException):
    """Authentication required or failed (401)."""

    status_code = 401
    code = "UNAUTHORIZED"
    message = "Authentication is required"


class ForbiddenException(AppException):
    """Insufficient permissions (403)."""

    status_code = 403
    code = "FORBIDDEN"
    message = "You do not have permission to perform this action"


class NotFoundException(AppException):
    """Resource not found (404)."""

    status_code = 404
    code = "NOT_FOUND"
    message = "The requested resource was not found"


class ConflictException(AppException):
    """Resource conflict (409)."""

    status_code = 409
    code = "CONFLICT"
    message = "The request conflicts with the current state of the resource"


class PayloadTooLargeException(AppException):
    """Request payload exceeds limit (413)."""

    status_code = 413
    code = "PAYLOAD_TOO_LARGE"
    message = "The request payload exceeds the maximum allowed size"


class UnprocessableException(AppException):
    """Request is syntactically valid but semantically incorrect (422)."""

    status_code = 422
    code = "UNPROCESSABLE"
    message = "The request could not be processed"


class RateLimitedException(AppException):
    """Too many requests (429)."""

    status_code = 429
    code = "RATE_LIMITED"
    message = "Too many requests. Please try again later"

    def __init__(
        self,
        message: str | None = None,
        retry_after: int | None = None,
        details: list[dict[str, str]] | None = None,
    ) -> None:
        super().__init__(message=message, details=details)
        self.retry_after = retry_after


# --- Exception Handlers ---


def _format_pydantic_errors(exc: ValidationError) -> list[dict[str, str]]:
    """Convert Pydantic validation errors to our error detail format."""
    details: list[dict[str, str]] = []
    for error in exc.errors():
        # Build field path from location tuple
        field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
        details.append(
            {
                "field": field,
                "message": error["msg"],
            }
        )
    return details


async def _handle_pydantic_validation_error(
    request: Request, exc: ValidationError
) -> JSONResponse:
    """Handle Pydantic ValidationError → 400 with field-specific errors."""
    details = _format_pydantic_errors(exc)
    return error_response(
        status_code=400,
        code="VALIDATION_ERROR",
        message="Input validation failed",
        details=details,
    )


async def _handle_app_exception(request: Request, exc: AppException) -> JSONResponse:
    """Handle custom application exceptions → appropriate HTTP codes."""
    response = error_response(
        status_code=exc.status_code,
        code=exc.code,
        message=exc.message,
        details=exc.details,
    )
    # Add retry-after header for rate limiting
    if isinstance(exc, RateLimitedException) and exc.retry_after is not None:
        response.headers["Retry-After"] = str(exc.retry_after)
    return response


async def _handle_unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    """Handle unhandled exceptions → 500 with generic message (no stack trace)."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return error_response(
        status_code=500,
        code="INTERNAL_ERROR",
        message="An unexpected error occurred",
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers on the FastAPI application."""
    app.add_exception_handler(ValidationError, _handle_pydantic_validation_error)  # type: ignore[arg-type]
    app.add_exception_handler(AppException, _handle_app_exception)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, _handle_unhandled_exception)
