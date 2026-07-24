"""Tests for Clerk webhook handler.

Tests the webhook signature verification and event processing
for user.created, user.updated, organization.created, and
organizationMembership.created events.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import base64
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.features.auth.router import router
from app.features.auth.schemas import (
    ClerkOrganizationData,
    ClerkOrganizationMembershipData,
    ClerkUserData,
)
from app.features.auth.service import ClerkSyncService


# --- Test helpers ---


def _create_test_app() -> FastAPI:
    """Create a minimal app with the clerk webhook router."""
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    return app


def _generate_svix_headers(
    payload: bytes,
    secret: str,
    msg_id: str = "msg_test123",
    timestamp: int | None = None,
) -> dict[str, str]:
    """Generate valid svix webhook headers for testing.

    Svix uses the format: whsec_<base64-encoded-secret>
    Signature is computed as HMAC-SHA256 of "{msg_id}.{timestamp}.{body}"
    """
    if timestamp is None:
        timestamp = int(time.time())

    # The secret from Clerk is prefixed with "whsec_" and then base64 encoded
    # For svix verification, the secret is base64 decoded (after removing the prefix)
    if secret.startswith("whsec_"):
        secret_bytes = base64.b64decode(secret[6:])
    else:
        secret_bytes = base64.b64decode(secret)

    # Construct the signed content
    to_sign = f"{msg_id}.{timestamp}.{payload.decode('utf-8')}"
    signature = hmac.new(
        secret_bytes, to_sign.encode("utf-8"), hashlib.sha256
    ).digest()
    sig_b64 = base64.b64encode(signature).decode("utf-8")

    return {
        "svix-id": msg_id,
        "svix-timestamp": str(timestamp),
        "svix-signature": f"v1,{sig_b64}",
    }


# --- Schema Tests ---


class TestClerkUserDataSchema:
    """Tests for ClerkUserData schema."""

    def test_primary_email_from_primary_id(self):
        """Should extract primary email using primary_email_address_id."""
        data = ClerkUserData(
            id="user_123",
            email_addresses=[
                {"email_address": "secondary@test.com", "id": "email_1"},
                {"email_address": "primary@test.com", "id": "email_2"},
            ],
            primary_email_address_id="email_2",
        )
        assert data.primary_email == "primary@test.com"

    def test_primary_email_fallback_to_first(self):
        """Should fall back to first email if primary_email_address_id not set."""
        data = ClerkUserData(
            id="user_123",
            email_addresses=[
                {"email_address": "first@test.com", "id": "email_1"},
            ],
        )
        assert data.primary_email == "first@test.com"

    def test_primary_email_none_when_empty(self):
        """Should return None when no email addresses present."""
        data = ClerkUserData(id="user_123", email_addresses=[])
        assert data.primary_email is None

    def test_full_name_combined(self):
        """Should combine first and last name."""
        data = ClerkUserData(
            id="user_123",
            first_name="John",
            last_name="Doe",
        )
        assert data.full_name == "John Doe"

    def test_full_name_first_only(self):
        """Should handle first name only."""
        data = ClerkUserData(id="user_123", first_name="Jane")
        assert data.full_name == "Jane"

    def test_full_name_unknown_when_empty(self):
        """Should return 'Unknown' when no name provided."""
        data = ClerkUserData(id="user_123")
        assert data.full_name == "Unknown"


class TestClerkOrganizationMembershipData:
    """Tests for ClerkOrganizationMembershipData schema."""

    def test_clerk_user_id_from_public_data(self):
        """Should extract user_id from public_user_data."""
        data = ClerkOrganizationMembershipData(
            id="mem_123",
            organization={"id": "org_123", "name": "Test Org"},
            public_user_data={"user_id": "user_456"},
            role="org:admin",
        )
        assert data.clerk_user_id == "user_456"

    def test_clerk_user_id_none_without_public_data(self):
        """Should return None if public_user_data is missing."""
        data = ClerkOrganizationMembershipData(
            id="mem_123",
            organization={"id": "org_123", "name": "Test Org"},
            role="org:member",
        )
        assert data.clerk_user_id is None


# --- Service Tests ---


class TestClerkSyncServiceRoleMapping:
    """Tests for role mapping logic."""

    def test_maps_org_admin_to_admin(self):
        """org:admin maps to Admin."""
        assert ClerkSyncService._map_clerk_role("org:admin") == "Admin"

    def test_maps_org_member_to_hiring_manager(self):
        """org:member maps to Hiring_Manager."""
        assert ClerkSyncService._map_clerk_role("org:member") == "Hiring_Manager"

    def test_maps_admin_to_admin(self):
        """admin maps to Admin."""
        assert ClerkSyncService._map_clerk_role("admin") == "Admin"

    def test_maps_unknown_to_hiring_manager(self):
        """Unknown roles default to Hiring_Manager."""
        assert ClerkSyncService._map_clerk_role("org:custom_role") == "Hiring_Manager"


# --- Webhook Router Tests ---


class TestWebhookSignatureVerification:
    """Tests for webhook signature verification."""

    @pytest.fixture
    def app(self):
        return _create_test_app()

    @pytest.fixture
    def client(self, app):
        return TestClient(app)

    def test_returns_400_for_missing_svix_headers(self, client):
        """Should reject requests without svix signature headers."""
        with patch("app.features.auth.router.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                clerk_webhook_secret="whsec_dGVzdHNlY3JldA=="
            )
            response = client.post(
                "/api/v1/webhooks/clerk",
                content=json.dumps({"type": "user.created", "data": {}}),
                headers={"content-type": "application/json"},
            )
            assert response.status_code == 400

    def test_returns_400_for_invalid_signature(self, client):
        """Should reject requests with invalid signature."""
        with patch("app.features.auth.router.Webhook") as mock_webhook_class:
            from svix.webhooks import WebhookVerificationError

            mock_wh = MagicMock()
            mock_wh.verify.side_effect = WebhookVerificationError("Invalid signature")
            mock_webhook_class.return_value = mock_wh

            payload = json.dumps({"type": "user.created", "data": {"id": "user_123"}})
            response = client.post(
                "/api/v1/webhooks/clerk",
                content=payload,
                headers={
                    "content-type": "application/json",
                    "svix-id": "msg_test",
                    "svix-timestamp": str(int(time.time())),
                    "svix-signature": "v1,invalid_signature",
                },
            )
            assert response.status_code == 400
            assert "signature" in response.json()["error"].lower()

    def test_returns_200_for_valid_webhook(self, client):
        """Should return 200 for a properly signed webhook."""
        with patch("app.features.auth.router.Webhook") as mock_webhook_class:
            mock_wh = MagicMock()
            mock_wh.verify.return_value = {
                "type": "user.created",
                "data": {
                    "id": "user_123",
                    "email_addresses": [
                        {"email_address": "test@test.com", "id": "email_1"}
                    ],
                    "first_name": "Test",
                    "last_name": "User",
                    "primary_email_address_id": "email_1",
                },
            }
            mock_webhook_class.return_value = mock_wh

            with patch("app.features.auth.router.get_db") as mock_get_db:
                mock_session = AsyncMock()
                mock_get_db.return_value = mock_session

                with patch.object(
                    ClerkSyncService, "handle_user_created", new_callable=AsyncMock
                ) as mock_handler:
                    response = client.post(
                        "/api/v1/webhooks/clerk",
                        content=json.dumps({}),
                        headers={
                            "content-type": "application/json",
                            "svix-id": "msg_test",
                            "svix-timestamp": str(int(time.time())),
                            "svix-signature": "v1,test",
                        },
                    )
                    assert response.status_code == 200
                    assert response.json()["status"] == "received"


class TestWebhookEventRouting:
    """Tests for webhook event type routing."""

    @pytest.fixture
    def app(self):
        return _create_test_app()

    @pytest.fixture
    def client(self, app):
        return TestClient(app)

    def _mock_webhook_and_post(
        self, client: TestClient, event_type: str, data: dict[str, Any]
    ):
        """Helper to post a mocked webhook event."""
        with patch("app.features.auth.router.Webhook") as mock_webhook_class:
            mock_wh = MagicMock()
            mock_wh.verify.return_value = {"type": event_type, "data": data}
            mock_webhook_class.return_value = mock_wh

            response = client.post(
                "/api/v1/webhooks/clerk",
                content=json.dumps({"type": event_type, "data": data}),
                headers={
                    "content-type": "application/json",
                    "svix-id": "msg_test",
                    "svix-timestamp": str(int(time.time())),
                    "svix-signature": "v1,test",
                },
            )
        return response

    def test_routes_user_created_event(self, client):
        """Should route user.created events to the handler."""
        with patch.object(
            ClerkSyncService, "handle_user_created", new_callable=AsyncMock
        ) as mock_handler:
            response = self._mock_webhook_and_post(
                client,
                "user.created",
                {
                    "id": "user_123",
                    "email_addresses": [
                        {"email_address": "test@test.com", "id": "e1"}
                    ],
                    "first_name": "Jane",
                    "last_name": "Doe",
                    "primary_email_address_id": "e1",
                },
            )
            assert response.status_code == 200
            mock_handler.assert_called_once()

    def test_routes_user_updated_event(self, client):
        """Should route user.updated events to the handler."""
        with patch.object(
            ClerkSyncService, "handle_user_updated", new_callable=AsyncMock
        ) as mock_handler:
            response = self._mock_webhook_and_post(
                client,
                "user.updated",
                {
                    "id": "user_123",
                    "email_addresses": [
                        {"email_address": "updated@test.com", "id": "e1"}
                    ],
                    "first_name": "Jane",
                    "last_name": "Updated",
                    "primary_email_address_id": "e1",
                },
            )
            assert response.status_code == 200
            mock_handler.assert_called_once()

    def test_routes_organization_created_event(self, client):
        """Should route organization.created events to the handler."""
        with patch.object(
            ClerkSyncService,
            "handle_organization_created",
            new_callable=AsyncMock,
        ) as mock_handler:
            response = self._mock_webhook_and_post(
                client,
                "organization.created",
                {"id": "org_456", "name": "Acme Corp"},
            )
            assert response.status_code == 200
            mock_handler.assert_called_once()

    def test_routes_membership_created_event(self, client):
        """Should route organizationMembership.created events to the handler."""
        with patch.object(
            ClerkSyncService,
            "handle_organization_membership_created",
            new_callable=AsyncMock,
        ) as mock_handler:
            response = self._mock_webhook_and_post(
                client,
                "organizationMembership.created",
                {
                    "id": "mem_789",
                    "organization": {"id": "org_456", "name": "Acme Corp"},
                    "public_user_data": {"user_id": "user_123"},
                    "role": "org:admin",
                },
            )
            assert response.status_code == 200
            mock_handler.assert_called_once()

    def test_returns_200_for_unhandled_event_type(self, client):
        """Should return 200 for unrecognized event types (no-op)."""
        response = self._mock_webhook_and_post(
            client, "session.created", {"id": "sess_123"}
        )
        assert response.status_code == 200

    def test_returns_200_even_on_handler_error(self, client):
        """Should return 200 even if the handler raises an exception.

        This prevents Clerk from retrying on application errors.
        """
        with patch.object(
            ClerkSyncService,
            "handle_user_created",
            new_callable=AsyncMock,
            side_effect=Exception("DB error"),
        ):
            response = self._mock_webhook_and_post(
                client,
                "user.created",
                {
                    "id": "user_123",
                    "email_addresses": [
                        {"email_address": "test@test.com", "id": "e1"}
                    ],
                    "primary_email_address_id": "e1",
                },
            )
            assert response.status_code == 200
