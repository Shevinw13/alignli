"""Alignli Backend - FastAPI Application Entry Point."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.database.session import check_db_connection
from app.core.security.exceptions import register_exception_handlers
from app.core.middleware import RateLimitMiddleware
from app.core.middleware.csrf import (
    CSRF_COOKIE_NAME,
    CSRFMiddleware,
    generate_csrf_token,
)
from app.core.events import events_router
from app.features.auth.router import router as clerk_webhook_router
from app.features.ai.router import router as ai_router
from app.features.billing.router import router as billing_router
from app.features.billing.router import webhook_router as billing_webhook_router
from app.features.candidates.router import candidates_list_router, candidates_profile_router
from app.features.communication.router import router as communication_router
from app.features.comparison.router import router as comparison_router
from app.features.hiring_projects.router import router as hiring_projects_router
from app.features.ingestion.router import router as ingestion_router
from app.features.ingestion.router import retry_router as ingestion_retry_router


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        debug=settings.debug,
        docs_url="/docs" if settings.app_env == "development" else None,
        redoc_url="/redoc" if settings.app_env == "development" else None,
    )

    # CORS middleware (outermost - runs first on response)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # CSRF middleware
    app.add_middleware(
        CSRFMiddleware,
        cookie_secure=settings.is_production,
        cookie_samesite="lax",
    )

    # Rate limiting middleware
    app.add_middleware(RateLimitMiddleware)

    # Register global exception handlers
    register_exception_handlers(app)

    # Health check - basic application health
    @app.get("/health")
    async def health_check() -> dict[str, str]:
        return {"status": "healthy"}

    # Database health check - verifies DB connection is working
    @app.get("/health/db")
    async def db_health_check() -> JSONResponse:
        is_healthy = await check_db_connection()
        if is_healthy:
            return JSONResponse(
                status_code=200,
                content={"status": "healthy", "database": "connected"},
            )
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "disconnected"},
        )

    # CSRF token endpoint - provides a fresh CSRF token
    @app.get(f"{settings.api_v1_prefix}/csrf-token")
    async def get_csrf_token(request: Request) -> JSONResponse:
        """Get a fresh CSRF token.

        Returns the token in both the response body and as a cookie.
        The frontend should include this token in the X-CSRF-Token header
        for all state-changing requests.
        """
        token = generate_csrf_token()
        response = JSONResponse(content={"csrf_token": token})
        response.set_cookie(
            key=CSRF_COOKIE_NAME,
            value=token,
            httponly=False,  # Frontend needs to read this cookie
            secure=settings.is_production,
            samesite="lax",
            path="/",
        )
        return response

    # Register feature routers
    app.include_router(
        hiring_projects_router,
        prefix=f"{settings.api_v1_prefix}",
    )
    app.include_router(
        candidates_list_router,
        prefix=f"{settings.api_v1_prefix}",
    )
    app.include_router(
        candidates_profile_router,
        prefix=f"{settings.api_v1_prefix}",
    )
    app.include_router(
        comparison_router,
        prefix=f"{settings.api_v1_prefix}",
    )
    app.include_router(
        ingestion_router,
        prefix=f"{settings.api_v1_prefix}",
    )
    app.include_router(
        ingestion_retry_router,
        prefix=f"{settings.api_v1_prefix}",
    )
    app.include_router(
        events_router,
        prefix=f"{settings.api_v1_prefix}",
    )
    app.include_router(
        communication_router,
        prefix=f"{settings.api_v1_prefix}",
    )
    app.include_router(
        ai_router,
        prefix=f"{settings.api_v1_prefix}",
    )
    app.include_router(
        billing_router,
        prefix=f"{settings.api_v1_prefix}",
    )
    app.include_router(
        billing_webhook_router,
        prefix=f"{settings.api_v1_prefix}",
    )
    app.include_router(
        clerk_webhook_router,
        prefix=f"{settings.api_v1_prefix}",
    )

    return app


app = create_app()
