"""Shared test fixtures and configuration."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.middleware.rate_limit import get_rate_limit_store


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset the rate limiter store before each test to prevent cross-test interference."""
    get_rate_limit_store().reset()
    yield
    get_rate_limit_store().reset()


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI application."""
    return TestClient(app)
