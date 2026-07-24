"""API routes for Billing and Subscription management.

Endpoints:
- GET /api/v1/billing/plan — View current plan and status
- GET /api/v1/billing/usage — View usage metrics
- GET /api/v1/billing/history — View billing history
- POST /api/v1/billing/upgrade — Initiate plan upgrade
- POST /api/v1/billing/downgrade — Initiate plan downgrade
- POST /api/v1/webhooks/stripe — Stripe webhook handler

Requirements: 17.1, 17.5, 17.6, 17.7, 17.8
"""

from __future__ import annotations

import logging

import stripe
from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database.session import get_db
from app.core.middleware.auth import AuthenticatedUser, get_current_user
from app.features.billing.schemas import (
    BillingHistoryResponse,
    DowngradeRequest,
    DowngradeResponse,
    PlanResponse,
    UpgradeRequest,
    UpgradeResponse,
    UsageResponse,
)
from app.features.billing.service import BillingService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/billing",
    tags=["Billing"],
)

webhook_router = APIRouter(
    prefix="/webhooks",
    tags=["Webhooks"],
)


def _get_service(session: AsyncSession = Depends(get_db)) -> BillingService:
    """Dependency to create BillingService with the current session."""
    return BillingService(session)


@router.get("/plan", response_model=PlanResponse)
async def get_current_plan(
    user: AuthenticatedUser = Depends(get_current_user),
    service: BillingService = Depends(_get_service),
) -> PlanResponse:
    """View current subscription plan and status.

    Returns the plan details, limits, and billing period information.
    """
    return await service.get_current_plan()


@router.get("/usage", response_model=UsageResponse)
async def get_usage(
    user: AuthenticatedUser = Depends(get_current_user),
    service: BillingService = Depends(_get_service),
) -> UsageResponse:
    """View current usage metrics.

    Returns usage data for resume reviews, active projects,
    storage, and AI credits relative to plan limits.
    """
    return await service.get_usage()


@router.get("/history", response_model=BillingHistoryResponse)
async def get_billing_history(
    user: AuthenticatedUser = Depends(get_current_user),
    service: BillingService = Depends(_get_service),
) -> BillingHistoryResponse:
    """View billing history (invoices).

    Returns the most recent invoices from Stripe.
    """
    return await service.get_billing_history()


@router.post("/upgrade", response_model=UpgradeResponse)
async def upgrade_plan(
    request: UpgradeRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    service: BillingService = Depends(_get_service),
) -> UpgradeResponse:
    """Initiate a plan upgrade.

    The upgrade takes effect immediately with prorated billing
    for the remainder of the current cycle.
    """
    return await service.upgrade_plan(target_plan=request.target_plan)


@router.post("/downgrade", response_model=DowngradeResponse)
async def downgrade_plan(
    request: DowngradeRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    service: BillingService = Depends(_get_service),
) -> DowngradeResponse:
    """Initiate a plan downgrade.

    The downgrade takes effect at the end of the current billing cycle.
    If current usage exceeds the target plan limits, a warning is returned
    and the user must acknowledge before proceeding.
    """
    return await service.downgrade_plan(
        target_plan=request.target_plan,
        acknowledge_warnings=request.acknowledge_warnings,
    )


@webhook_router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(alias="stripe-signature"),
    session: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """Handle Stripe webhook events.

    Verifies the webhook signature using the Stripe webhook secret,
    then processes the event for subscription lifecycle management.

    Handles:
    - customer.subscription.created
    - customer.subscription.updated
    - customer.subscription.deleted
    - invoice.payment_failed
    """
    settings = get_settings()
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=stripe_signature,
            secret=settings.stripe_webhook_secret,
        )
    except ValueError:
        logger.warning("Invalid Stripe webhook payload")
        return JSONResponse(status_code=400, content={"error": "Invalid payload"})
    except stripe.SignatureVerificationError:
        logger.warning("Invalid Stripe webhook signature")
        return JSONResponse(
            status_code=400, content={"error": "Invalid signature"}
        )

    # Process the event
    service = BillingService(session)
    try:
        await service.handle_webhook_event(event)
    except Exception as e:
        logger.exception("Error processing Stripe webhook event: %s", str(e))
        # Return 200 to prevent Stripe from retrying on application errors
        # The error is logged for investigation

    return JSONResponse(status_code=200, content={"status": "received"})
