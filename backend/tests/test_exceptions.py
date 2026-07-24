"""Tests for global exception handling and error response format."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, ValidationError

from app.core.security.exceptions import (
    AppException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    PayloadTooLargeException,
    RateLimitedException,
    UnauthorizedException,
    UnprocessableException,
    ValidationException,
    register_exception_handlers,
)


def _create_test_app() -> FastAPI:
    """Create a minimal FastAPI app with exception handlers registered."""
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/raise-validation")
    async def raise_validation():
        raise ValidationException(
            message="Title is required",
            details=[{"field": "title", "message": "Title is required"}],
        )

    @app.get("/raise-unauthorized")
    async def raise_unauthorized():
        raise UnauthorizedException()

    @app.get("/raise-forbidden")
    async def raise_forbidden():
        raise ForbiddenException()

    @app.get("/raise-not-found")
    async def raise_not_found():
        raise NotFoundException(message="Project not found")

    @app.get("/raise-conflict")
    async def raise_conflict():
        raise ConflictException(message="Cannot transition from Draft to Filled")

    @app.get("/raise-payload-too-large")
    async def raise_payload_too_large():
        raise PayloadTooLargeException()

    @app.get("/raise-unprocessable")
    async def raise_unprocessable():
        raise UnprocessableException()

    @app.get("/raise-rate-limited")
    async def raise_rate_limited():
        raise RateLimitedException(retry_after=30)

    @app.get("/raise-unhandled")
    async def raise_unhandled():
        raise RuntimeError("Something went very wrong")

    class InputModel(BaseModel):
        name: str
        age: int

    @app.post("/pydantic-error")
    async def pydantic_error():
        # Force a Pydantic validation error
        try:
            InputModel(name=123, age="not-a-number")  # type: ignore[arg-type]
        except ValidationError as e:
            raise e

    return app


client = TestClient(_create_test_app(), raise_server_exceptions=False)


class TestErrorResponseFormat:
    """Verify the consistent error response format."""

    def test_error_response_structure(self):
        response = client.get("/raise-validation")
        data = response.json()
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]

    def test_error_response_with_details(self):
        response = client.get("/raise-validation")
        data = response.json()
        assert "details" in data["error"]
        assert data["error"]["details"][0]["field"] == "title"
        assert data["error"]["details"][0]["message"] == "Title is required"


class TestValidationException:
    def test_returns_400(self):
        response = client.get("/raise-validation")
        assert response.status_code == 400

    def test_returns_validation_error_code(self):
        response = client.get("/raise-validation")
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"


class TestUnauthorizedException:
    def test_returns_401(self):
        response = client.get("/raise-unauthorized")
        assert response.status_code == 401

    def test_returns_unauthorized_code(self):
        response = client.get("/raise-unauthorized")
        assert response.json()["error"]["code"] == "UNAUTHORIZED"


class TestForbiddenException:
    def test_returns_403(self):
        response = client.get("/raise-forbidden")
        assert response.status_code == 403

    def test_returns_forbidden_code(self):
        response = client.get("/raise-forbidden")
        assert response.json()["error"]["code"] == "FORBIDDEN"


class TestNotFoundException:
    def test_returns_404(self):
        response = client.get("/raise-not-found")
        assert response.status_code == 404

    def test_returns_not_found_code(self):
        response = client.get("/raise-not-found")
        assert response.json()["error"]["code"] == "NOT_FOUND"

    def test_includes_custom_message(self):
        response = client.get("/raise-not-found")
        assert response.json()["error"]["message"] == "Project not found"


class TestConflictException:
    def test_returns_409(self):
        response = client.get("/raise-conflict")
        assert response.status_code == 409

    def test_returns_conflict_code(self):
        response = client.get("/raise-conflict")
        assert response.json()["error"]["code"] == "CONFLICT"


class TestPayloadTooLargeException:
    def test_returns_413(self):
        response = client.get("/raise-payload-too-large")
        assert response.status_code == 413

    def test_returns_payload_too_large_code(self):
        response = client.get("/raise-payload-too-large")
        assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


class TestUnprocessableException:
    def test_returns_422(self):
        response = client.get("/raise-unprocessable")
        assert response.status_code == 422

    def test_returns_unprocessable_code(self):
        response = client.get("/raise-unprocessable")
        assert response.json()["error"]["code"] == "UNPROCESSABLE"


class TestRateLimitedException:
    def test_returns_429(self):
        response = client.get("/raise-rate-limited")
        assert response.status_code == 429

    def test_returns_rate_limited_code(self):
        response = client.get("/raise-rate-limited")
        assert response.json()["error"]["code"] == "RATE_LIMITED"

    def test_includes_retry_after_header(self):
        response = client.get("/raise-rate-limited")
        assert response.headers["Retry-After"] == "30"


class TestUnhandledException:
    def test_returns_500(self):
        response = client.get("/raise-unhandled")
        assert response.status_code == 500

    def test_returns_internal_error_code(self):
        response = client.get("/raise-unhandled")
        assert response.json()["error"]["code"] == "INTERNAL_ERROR"

    def test_does_not_expose_stack_trace(self):
        response = client.get("/raise-unhandled")
        data = response.json()
        assert "traceback" not in str(data).lower()
        assert "RuntimeError" not in str(data)
        assert "Something went very wrong" not in str(data)

    def test_generic_message(self):
        response = client.get("/raise-unhandled")
        assert response.json()["error"]["message"] == "An unexpected error occurred"


class TestPydanticValidationError:
    def test_returns_400(self):
        response = client.post("/pydantic-error")
        assert response.status_code == 400

    def test_returns_validation_error_code(self):
        response = client.post("/pydantic-error")
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_includes_field_details(self):
        response = client.post("/pydantic-error")
        data = response.json()
        assert "details" in data["error"]
        fields = [d["field"] for d in data["error"]["details"]]
        assert "age" in fields
