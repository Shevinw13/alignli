"""Schemas for Clerk webhook payloads.

These schemas represent the expected structure of Clerk webhook event data
for user and organization lifecycle events.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class ClerkEmailAddress(BaseModel):
    """Email address from Clerk user data."""

    email_address: str
    id: str
    verification: Optional[dict[str, Any]] = None


class ClerkUserData(BaseModel):
    """User data from Clerk webhook payload."""

    id: str
    email_addresses: list[ClerkEmailAddress] = []
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    primary_email_address_id: Optional[str] = None
    image_url: Optional[str] = None

    @property
    def primary_email(self) -> Optional[str]:
        """Get the primary email address."""
        if self.primary_email_address_id:
            for email in self.email_addresses:
                if email.id == self.primary_email_address_id:
                    return email.email_address
        # Fallback to first email
        if self.email_addresses:
            return self.email_addresses[0].email_address
        return None

    @property
    def full_name(self) -> str:
        """Get the full name, combining first and last."""
        parts = []
        if self.first_name:
            parts.append(self.first_name)
        if self.last_name:
            parts.append(self.last_name)
        return " ".join(parts) if parts else "Unknown"


class ClerkOrganizationData(BaseModel):
    """Organization data from Clerk webhook payload."""

    id: str
    name: str
    slug: Optional[str] = None
    created_by: Optional[str] = None


class ClerkOrganizationMembershipData(BaseModel):
    """Organization membership data from Clerk webhook payload."""

    id: str
    organization: ClerkOrganizationData
    public_user_data: Optional[dict[str, Any]] = None
    role: str = "org:member"

    @property
    def clerk_user_id(self) -> Optional[str]:
        """Extract the user ID from public_user_data."""
        if self.public_user_data:
            return self.public_user_data.get("user_id")
        return None


class ClerkWebhookEvent(BaseModel):
    """Top-level Clerk webhook event structure."""

    type: str
    data: dict[str, Any]
    object: str = "event"
