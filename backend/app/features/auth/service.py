"""Service for syncing Clerk webhook data to local database.

Handles:
- user.created: Creates a local user record linked to the Clerk user
- user.updated: Updates the local user record (email, name)
- organization.created: Creates a local organization record
- organizationMembership.created: Links a user to an organization (invitation acceptance)

Requirements: 1.1, 1.2, 1.5
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.schemas import (
    ClerkOrganizationData,
    ClerkOrganizationMembershipData,
    ClerkUserData,
)

logger = logging.getLogger(__name__)


class ClerkSyncService:
    """Service for syncing Clerk users and organizations to the local database."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def handle_user_created(self, user_data: ClerkUserData) -> None:
        """Handle user.created webhook event.

        Creates a local user record. If the user doesn't have an organization
        yet (no org membership), we store them without an org_id and will
        associate them when the organization membership event arrives.

        For the initial sign-up flow, Clerk creates the user first, then
        the organization, then the membership. We handle the user creation
        here and finalize the org link on membership creation.
        """
        email = user_data.primary_email
        if not email:
            logger.warning(
                "User created without email, skipping sync: clerk_user_id=%s",
                user_data.id,
            )
            return

        # Check if user already exists
        from sqlalchemy import text as sa_text

        result = await self.session.execute(
            select(sa_text("1"))
            .select_from(sa_text("users"))
            .where(sa_text(f"clerk_user_id = '{user_data.id}'"))
        )
        # Use raw SQL to avoid needing ORM models for the webhook handler
        existing = result.scalar_one_or_none()
        if existing:
            logger.info(
                "User already exists locally, skipping create: clerk_user_id=%s",
                user_data.id,
            )
            return

        # We need an organization_id to create a user due to the FK constraint.
        # If the user doesn't have one yet, we'll defer creation to the
        # organizationMembership.created handler.
        logger.info(
            "User created event received, deferring full sync to membership event: "
            "clerk_user_id=%s, email=%s",
            user_data.id,
            email,
        )

    async def handle_user_updated(self, user_data: ClerkUserData) -> None:
        """Handle user.updated webhook event.

        Updates the local user record's email and name to match Clerk.
        """
        email = user_data.primary_email
        full_name = user_data.full_name

        from sqlalchemy import text as sa_text

        # Update the user record if it exists
        result = await self.session.execute(
            sa_text(
                "UPDATE users SET email = :email, full_name = :full_name, "
                "updated_at = now() WHERE clerk_user_id = :clerk_user_id"
            ),
            {
                "email": email or "",
                "full_name": full_name,
                "clerk_user_id": user_data.id,
            },
        )

        if result.rowcount == 0:  # type: ignore[attr-defined]
            logger.warning(
                "User not found locally for update: clerk_user_id=%s",
                user_data.id,
            )
        else:
            logger.info(
                "User updated locally: clerk_user_id=%s, email=%s",
                user_data.id,
                email,
            )

    async def handle_organization_created(
        self, org_data: ClerkOrganizationData
    ) -> None:
        """Handle organization.created webhook event.

        Creates a local organization record linked to the Clerk org.
        This is triggered when a user creates an organization during sign-up
        or from the dashboard.

        Requirements: 1.2 - Platform creates an Organization with the provided name
        """
        from sqlalchemy import text as sa_text

        # Check if org already exists
        result = await self.session.execute(
            sa_text("SELECT id FROM organizations WHERE clerk_org_id = :clerk_org_id"),
            {"clerk_org_id": org_data.id},
        )
        existing = result.scalar_one_or_none()
        if existing:
            logger.info(
                "Organization already exists locally: clerk_org_id=%s",
                org_data.id,
            )
            return

        # Create the organization
        await self.session.execute(
            sa_text(
                "INSERT INTO organizations (name, clerk_org_id) "
                "VALUES (:name, :clerk_org_id)"
            ),
            {
                "name": org_data.name,
                "clerk_org_id": org_data.id,
            },
        )

        logger.info(
            "Organization created locally: clerk_org_id=%s, name=%s",
            org_data.id,
            org_data.name,
        )

    async def handle_organization_membership_created(
        self, membership_data: ClerkOrganizationMembershipData
    ) -> None:
        """Handle organizationMembership.created webhook event.

        This event fires when a user joins an organization, either:
        - During initial sign-up (owner creating a new org)
        - When accepting an invitation (invited user joining existing org)

        Links the user to the organization in the local database.
        If the user doesn't exist locally yet, creates them.

        Requirements: 1.2 (assign Owner role), 1.5 (invitation acceptance)
        """
        from sqlalchemy import text as sa_text

        clerk_user_id = membership_data.clerk_user_id
        clerk_org_id = membership_data.organization.id

        if not clerk_user_id:
            logger.warning(
                "Membership created without user_id in public_user_data, "
                "skipping: membership_id=%s",
                membership_data.id,
            )
            return

        # Look up the local organization
        result = await self.session.execute(
            sa_text("SELECT id FROM organizations WHERE clerk_org_id = :clerk_org_id"),
            {"clerk_org_id": clerk_org_id},
        )
        org_uuid = result.scalar_one_or_none()
        if not org_uuid:
            logger.error(
                "Organization not found locally for membership: clerk_org_id=%s",
                clerk_org_id,
            )
            return

        # Map Clerk role to our role system
        role = self._map_clerk_role(membership_data.role)

        # Check if user already exists
        result = await self.session.execute(
            sa_text("SELECT id FROM users WHERE clerk_user_id = :clerk_user_id"),
            {"clerk_user_id": clerk_user_id},
        )
        existing_user_id = result.scalar_one_or_none()

        if existing_user_id:
            # Update the user's organization and role
            await self.session.execute(
                sa_text(
                    "UPDATE users SET organization_id = :org_id, role = :role, "
                    "updated_at = now() WHERE clerk_user_id = :clerk_user_id"
                ),
                {
                    "org_id": str(org_uuid),
                    "role": role,
                    "clerk_user_id": clerk_user_id,
                },
            )
            logger.info(
                "User org membership updated: clerk_user_id=%s, org=%s, role=%s",
                clerk_user_id,
                clerk_org_id,
                role,
            )
        else:
            # Create user with org association
            # Extract email and name from public_user_data if available
            public_data = membership_data.public_user_data or {}
            email = public_data.get("identifier", "")
            first_name = public_data.get("first_name", "")
            last_name = public_data.get("last_name", "")
            full_name = f"{first_name} {last_name}".strip() or "Unknown"

            await self.session.execute(
                sa_text(
                    "INSERT INTO users (organization_id, clerk_user_id, email, full_name, role) "
                    "VALUES (:org_id, :clerk_user_id, :email, :full_name, :role)"
                ),
                {
                    "org_id": str(org_uuid),
                    "clerk_user_id": clerk_user_id,
                    "email": email,
                    "full_name": full_name,
                    "role": role,
                },
            )
            logger.info(
                "User created locally via membership: clerk_user_id=%s, org=%s, role=%s",
                clerk_user_id,
                clerk_org_id,
                role,
            )

    @staticmethod
    def _map_clerk_role(clerk_role: str) -> str:
        """Map Clerk organization role to Alignli role.

        Clerk roles: org:admin, org:member, org:custom_role
        Alignli roles: Owner, Admin, Hiring_Manager, Recruiter, Viewer
        """
        role_map = {
            "org:admin": "Admin",
            "org:member": "Hiring_Manager",
            "admin": "Admin",
            "member": "Hiring_Manager",
        }
        return role_map.get(clerk_role, "Hiring_Manager")
