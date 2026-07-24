"""Base configuration module with environment variable loading."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    All secrets and service keys are loaded from environment variables.
    See .env.example for the full list of required configuration.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "Alignli"
    app_env: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Database (Supabase PostgreSQL)
    database_url: str = "postgresql+asyncpg://localhost:5432/alignli"

    # Clerk Authentication
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    clerk_webhook_secret: str = ""

    # Supabase Storage
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Stripe Billing
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_publishable_key: str = ""

    # Resend Email
    resend_api_key: str = ""
    resend_from_email: str = "noreply@alignli.com"

    # Anthropic AI
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"

    # Inngest Background Jobs
    inngest_event_key: str = ""
    inngest_signing_key: str = ""

    # Rate Limiting
    rate_limit_authenticated: int = 100  # requests per minute
    rate_limit_unauthenticated: int = 20  # requests per minute

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.app_env == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
