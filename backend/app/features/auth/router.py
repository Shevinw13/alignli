"""Clerk webhook handler for user/org sync.

Validates Clerk webhook signatures using svix and syncs
user/organization data to the local database.

Handles:
- user.created: Sync new user to local DB
- user.updated: Update local user record
- organization.created: Create local organization
- organizationMembership.created: Link user to org (invitation acceptance)

Requirements: 1.1, 1.2, 1.5
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from app.core.config import Settings, get_settings
from app.core.database.session import get_db
from app.features.auth.schemas import (
    ClerkOrganizationData,
    ClerkOrganizationMembershipData,
    ClerkUserData,
    ClerkWebhookEvent,
)
from app.features.auth.service import ClerkSyncService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/webhooks",
    tags=["Webhooks"],
)


@router.post("/clerk")
async def clerk_webhook(
    request: Request,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> JSONResponse:
    """Handle Clerk webhook events.

    Verifies the webhook signature using svix, then processes
    the event to sync user and organization data to the local database.

    The endpoint does NOT require authentication — webhook verification
    is done via the svix signature headers instead.
    """
    payload = await request.body()
    headers = dict(request.headers)

    # Verify the webhook signature using svix
    try:
        wh = Webhook(settings.clerk_webhook_secret)
        event_data = wh.verify(payload, headers)
    except WebhookVerificationError:
        logger.warning("Invalid Clerk webhook signature")
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid webhook signature"},
        )
    except Exception as e:
        logger.error("Clerk webhook verification error: %s", str(e))
        return JSONResponse(
            status_code=400,
            content={"error": "Webhook verification failed"},
        )

    # Parse the event type from the headers or payload
    event_type = headers.get("svix-event-type") or event_data.get("type", "")

    # If event_data contains the full event envelope, extract data
    # Clerk sends: { "type": "...", "data": {...}, "object": "event" }
    if "type" in event_data:
        event_type = event_data["type"]
        data = event_data.get("data", {})
    else:
        data = event_data

    logger.info("Processing Clerk webhook event: type=%s", event_type)

    service = ClerkSyncService(session)

    try:
        if event_type == "user.created":
            user_data = ClerkUserData(**data)
            await service.handle_user_created(user_data)

        elif event_type == "user.updated":
            user_data = ClerkUserData(**data)
            await service.handle_user_updated(user_data)

        elif event_type == "organization.created":
            org_data = ClerkOrganizationData(**data)
            await service.handle_organization_created(org_data)

        elif event_type == "organizationMembership.created":
            membership_data = ClerkOrganizationMembershipData(**data)
            await service.handle_organization_membership_created(membership_data)

        else:
            logger.debug("Unhandled Clerk webhook event type: %s", event_type)

    except Exception as e:
        logger.exception(
            "Error processing Clerk webhook event: type=%s, error=%s",
            event_type,
            str(e),
        )
        # Return 200 to prevent Clerk from retrying on application errors.
        # The error is logged for investigation.

    return JSONResponse(status_code=200, content={"status": "received"})
