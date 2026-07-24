"""Tests for the base configuration module."""

from app.core.config import Settings, get_settings


def test_settings_default_values():
    """Settings should have sensible defaults for development."""
    settings = Settings(
        _env_file=None,  # type: ignore[call-arg]
    )
    assert settings.app_name == "Alignli"
    assert settings.app_env == "development"
    assert settings.debug is False
    assert settings.api_v1_prefix == "/api/v1"
    assert settings.rate_limit_authenticated == 100
    assert settings.rate_limit_unauthenticated == 20
    assert settings.cors_origins == ["http://localhost:3000"]
    assert settings.anthropic_model == "claude-sonnet-4-20250514"
    assert settings.resend_from_email == "noreply@alignli.com"


def test_settings_is_production():
    """is_production property should reflect app_env."""
    settings = Settings(app_env="production", _env_file=None)  # type: ignore[call-arg]
    assert settings.is_production is True
    assert settings.is_development is False


def test_settings_is_development():
    """is_development property should reflect app_env."""
    settings = Settings(app_env="development", _env_file=None)  # type: ignore[call-arg]
    assert settings.is_development is True
    assert settings.is_production is False


def test_settings_all_service_keys_present():
    """All external service keys should be defined in Settings."""
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    # Verify all service key fields exist (even if empty by default)
    assert hasattr(settings, "database_url")
    assert hasattr(settings, "clerk_secret_key")
    assert hasattr(settings, "clerk_publishable_key")
    assert hasattr(settings, "clerk_webhook_secret")
    assert hasattr(settings, "supabase_url")
    assert hasattr(settings, "supabase_service_role_key")
    assert hasattr(settings, "stripe_secret_key")
    assert hasattr(settings, "stripe_webhook_secret")
    assert hasattr(settings, "stripe_publishable_key")
    assert hasattr(settings, "resend_api_key")
    assert hasattr(settings, "anthropic_api_key")
    assert hasattr(settings, "inngest_event_key")
    assert hasattr(settings, "inngest_signing_key")


def test_get_settings_returns_instance():
    """get_settings should return a Settings instance."""
    settings = get_settings()
    assert isinstance(settings, Settings)
