"""Tests for the FastAPI application entry point."""

from fastapi.testclient import TestClient

from app.main import app


def test_health_check():
    """Health check endpoint should return healthy status."""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_docs_available_in_development():
    """OpenAPI docs should be available in development mode."""
    client = TestClient(app)
    response = client.get("/docs")
    # In development mode, docs should be available
    assert response.status_code == 200
