"""Business logic for Billing and Subscription management.

Handles:
- Viewing current plan and usage
- Plan upgrades (immediate) and downgrades (end of cycle)
- Stripe webhook processing for subscription lifecycle events
- Payment failure flow: 24h notification, 7-day grace period, then read-only

Requirements: 17.1, 17.5, 17.6, 17.7, 17.8
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security.exceptions import (
    ConflictException,
    NotFoundException,
    ValidationException,
)
from app.features.billing.repository import SubscriptionRepository
from app.features.billing.schemas import (
    PLAN_LIMITS,
    PLAN_ORDER,
    BillingHistoryItem,
    BillingHistoryResponse,
    DowngradeResponse,
    PlanResponse,
    PlanTier,
    SubscriptionStatus,
    UpgradeResponse,
    UsageMetric,
    UsageResponse,
)
from app.features.billing.usage import UsageTracker
from app.models.subscriptions import Subscription
from app.models.users import User

logger = logging.getLogger(__name__)

# Grace period duration after payment failure
GRACE_PERIOD_DAYS = 7


class BillingService:
    """Service layer for billing and subscription operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = SubscriptionRepository(session)
        self.usage_tracker = UsageTracker(session)
        settings = get_settings()
        stripe.api_key = settings.stripe_secret_key

    async def get_current_plan(self) -> PlanResponse:
        """Get the current subscription plan for the organization.

        Returns:
            PlanResponse with plan details and limits.

        Raises:
            NotFoundException: If no subscription exists for the organization.
        """
        subscription = await self.repository.get_by_organization()
        if subscription is None:
            raise NotFoundException(message="No subscription found for this organization")

        plan_tier = _resolve_plan_tier(subscription.plan_id)
        limits = PLAN_LIMITS.get(plan_tier, PLAN_LIMITS[PlanTier.STARTER])

        return PlanResponse(
            id=subscription.id,
            organization_id=subscription.organization_id,
            plan_id=subscription.plan_id,
            status=subscription.status,
            stripe_customer_id=subscription.stripe_customer_id,
            stripe_subscription_id=subscription.stripe_subscription_id,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            grace_period_end=subscription.grace_period_end,
            limits=limits,
        )

    async def get_usage(self) -> UsageResponse:
        """Get current usage metrics for the organization.

        Returns usage data for resume reviews, active projects,
        storage, and AI credits relative to plan limits.

        Returns:
            UsageResponse with metric details.

        Raises:
            NotFoundException: If no subscription exists for the organization.
        """
        subscription = await self.repository.get_by_organization()
        if subscription is None:
            raise NotFoundException(message="No subscription found for this organization")

        plan_tier = _resolve_plan_tier(subscription.plan_id)

        metrics = await self.usage_tracker.get_current_usage(
            plan_tier=plan_tier,
            period_start=subscription.current_period_start,
            period_end=subscription.current_period_end,
        )

        return UsageResponse(metrics=metrics, plan_id=subscription.plan_id)

    async def upgrade_plan(self, target_plan: PlanTier) -> UpgradeResponse:
        """Upgrade the subscription to a higher-tier plan.

        The upgrade takes effect immediately and Stripe prorates
        the billing for the remainder of the current cycle.

        Args:
            target_plan: The plan tier to upgrade to.

        Returns:
            UpgradeResponse confirming the upgrade.

        Raises:
            NotFoundException: If no subscription exists.
            ValidationException: If the target plan is not a valid upgrade.
        """
        subscription = await self.repository.get_by_organization()
        if subscription is None:
            raise NotFoundException(message="No subscription found for this organization")

        current_tier = _resolve_plan_tier(subscription.plan_id)
        _validate_upgrade(current_tier, target_plan)

        # Call Stripe to update the subscription
        try:
            if subscription.stripe_subscription_id:
                stripe_sub = stripe.Subscription.retrieve(
                    subscription.stripe_subscription_id
                )
                # Update the subscription item to the new plan's price
                stripe.Subscription.modify(
                    subscription.stripe_subscription_id,
                    items=[
                        {
                            "id": stripe_sub["items"]["data"][0]["id"],
                            "price": _get_stripe_price_id(target_plan),
                        }
                    ],
                    proration_behavior="create_prorations",
                )
        except stripe.StripeError as e:
            logger.error("Stripe upgrade failed: %s", str(e))
            raise ConflictException(
                message=f"Failed to process upgrade: {str(e)}"
            )

        # Update local subscription record
        await self.repository.update_plan(
            subscription_id=subscription.id,
            plan_id=target_plan.value,
        )

        return UpgradeResponse(
            success=True,
            message=f"Successfully upgraded to {target_plan.value} plan",
            new_plan=target_plan.value,
            effective_immediately=True,
        )

    async def downgrade_plan(
        self, target_plan: PlanTier, acknowledge_warnings: bool = False
    ) -> DowngradeResponse:
        """Downgrade the subscription to a lower-tier plan.

        The downgrade takes effect at the end of the current billing cycle.
        If current usage exceeds the target plan's limits, the user must
        acknowledge the warnings before proceeding.

        Args:
            target_plan: The plan tier to downgrade to.
            acknowledge_warnings: Whether the user has acknowledged usage warnings.

        Returns:
            DowngradeResponse with any warnings about exceeding limits.

        Raises:
            NotFoundException: If no subscription exists.
            ValidationException: If the target plan is not a valid downgrade
                                 or if warnings are not acknowledged.
        """
        subscription = await self.repository.get_by_organization()
        if subscription is None:
            raise NotFoundException(message="No subscription found for this organization")

        current_tier = _resolve_plan_tier(subscription.plan_id)
        _validate_downgrade(current_tier, target_plan)

        # Check if current usage exceeds target plan limits
        target_limits = PLAN_LIMITS[target_plan]
        warnings = await self.usage_tracker.get_downgrade_warnings(
            target_plan=target_plan,
            period_start=subscription.current_period_start,
            period_end=subscription.current_period_end,
        )

        if warnings and not acknowledge_warnings:
            raise ValidationException(
                message="Current usage exceeds the target plan limits. "
                "Please acknowledge the warnings to proceed.",
                details=[{"field": "acknowledge_warnings", "message": w} for w in warnings],
            )

        # Schedule downgrade in Stripe at end of billing cycle
        try:
            if subscription.stripe_subscription_id:
                stripe_sub = stripe.Subscription.retrieve(
                    subscription.stripe_subscription_id
                )
                stripe.Subscription.modify(
                    subscription.stripe_subscription_id,
                    items=[
                        {
                            "id": stripe_sub["items"]["data"][0]["id"],
                            "price": _get_stripe_price_id(target_plan),
                        }
                    ],
                    proration_behavior="none",
                )
        except stripe.StripeError as e:
            logger.error("Stripe downgrade failed: %s", str(e))
            raise ConflictException(
                message=f"Failed to process downgrade: {str(e)}"
            )

        # Update local record - plan change effective at cycle end
        await self.repository.update_plan(
            subscription_id=subscription.id,
            plan_id=target_plan.value,
        )

        return DowngradeResponse(
            success=True,
            message=f"Plan will be downgraded to {target_plan.value} at the end of the current billing cycle",
            new_plan=target_plan.value,
            effective_at_cycle_end=True,
            warnings=warnings,
        )

    async def get_billing_history(self) -> BillingHistoryResponse:
        """Get billing history (invoices) from Stripe.

        Returns:
            BillingHistoryResponse with invoice list.

        Raises:
            NotFoundException: If no subscription exists.
        """
        subscription = await self.repository.get_by_organization()
        if subscription is None:
            raise NotFoundException(message="No subscription found for this organization")

        items: list[BillingHistoryItem] = []
        try:
            invoices = stripe.Invoice.list(
                customer=subscription.stripe_customer_id,
                limit=20,
            )
            for invoice in invoices.get("data", []):
                items.append(
                    BillingHistoryItem(
                        id=invoice["id"],
                        amount=invoice.get("amount_paid", 0),
                        currency=invoice.get("currency", "usd"),
                        status=invoice.get("status", "unknown"),
                        description=invoice.get("description"),
                        created=datetime.fromtimestamp(
                            invoice["created"], tz=timezone.utc
                        ),
                    )
                )
        except stripe.StripeError as e:
            logger.error("Failed to fetch billing history from Stripe: %s", str(e))
            # Return empty list instead of failing completely
            pass

        return BillingHistoryResponse(items=items)

    async def handle_webhook_event(self, event: stripe.Event) -> None:
        """Process a Stripe webhook event.

        Handles subscription lifecycle events:
        - customer.subscription.created
        - customer.subscription.updated
        - customer.subscription.deleted (cancelled)
        - invoice.payment_failed

        Args:
            event: Verified Stripe Event object.
        """
        event_type = event["type"]

        if event_type == "customer.subscription.created":
            await self._handle_subscription_created(event["data"]["object"])
        elif event_type == "customer.subscription.updated":
            await self._handle_subscription_updated(event["data"]["object"])
        elif event_type == "customer.subscription.deleted":
            await self._handle_subscription_canceled(event["data"]["object"])
        elif event_type == "invoice.payment_failed":
            await self._handle_payment_failed(event["data"]["object"])
        else:
            logger.info("Unhandled Stripe event type: %s", event_type)

    async def _handle_subscription_created(self, stripe_sub: dict) -> None:
        """Handle a new subscription being created in Stripe.

        Updates or creates the local subscription record.
        """
        customer_id = stripe_sub["customer"]
        subscription = await self.repository.get_by_stripe_customer_id(customer_id)

        if subscription is None:
            logger.warning(
                "Subscription created webhook for unknown customer: %s", customer_id
            )
            return

        await self.repository.update(
            subscription.id,
            stripe_subscription_id=stripe_sub["id"],
            plan_id=_stripe_plan_to_tier(stripe_sub),
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=datetime.fromtimestamp(
                stripe_sub["current_period_start"], tz=timezone.utc
            ),
            current_period_end=datetime.fromtimestamp(
                stripe_sub["current_period_end"], tz=timezone.utc
            ),
        )

    async def _handle_subscription_updated(self, stripe_sub: dict) -> None:
        """Handle subscription updates (plan changes, renewals, etc.)."""
        sub_id = stripe_sub["id"]
        subscription = await self.repository.get_by_stripe_subscription_id(sub_id)

        if subscription is None:
            logger.warning(
                "Subscription updated webhook for unknown subscription: %s", sub_id
            )
            return

        status = stripe_sub.get("status", "active")
        mapped_status = _map_stripe_status(status)

        await self.repository.update(
            subscription.id,
            plan_id=_stripe_plan_to_tier(stripe_sub),
            status=mapped_status,
            current_period_start=datetime.fromtimestamp(
                stripe_sub["current_period_start"], tz=timezone.utc
            ),
            current_period_end=datetime.fromtimestamp(
                stripe_sub["current_period_end"], tz=timezone.utc
            ),
        )

    async def _handle_subscription_canceled(self, stripe_sub: dict) -> None:
        """Handle subscription cancellation."""
        sub_id = stripe_sub["id"]
        subscription = await self.repository.get_by_stripe_subscription_id(sub_id)

        if subscription is None:
            logger.warning(
                "Subscription canceled webhook for unknown subscription: %s", sub_id
            )
            return

        await self.repository.update_status(
            subscription_id=subscription.id,
            status=SubscriptionStatus.CANCELED.value,
        )

    async def _handle_payment_failed(self, invoice: dict) -> None:
        """Handle payment failure.

        Flow:
        1. Set subscription to grace_period status
        2. Calculate grace period end (7 days from now)
        3. Send notification email to org owner (within 24 hours)

        After grace period expires, a scheduled job will transition
        the subscription to read_only status.
        """
        customer_id = invoice.get("customer")
        if not customer_id:
            logger.warning("Payment failed webhook missing customer ID")
            return

        subscription = await self.repository.get_by_stripe_customer_id(customer_id)
        if subscription is None:
            logger.warning(
                "Payment failed webhook for unknown customer: %s", customer_id
            )
            return

        grace_end = datetime.now(timezone.utc) + timedelta(days=GRACE_PERIOD_DAYS)

        await self.repository.update_status(
            subscription_id=subscription.id,
            status=SubscriptionStatus.GRACE_PERIOD.value,
            grace_period_end=grace_end,
        )

        # Send payment failure notification email to org owner
        logger.info(
            "Payment failed for org %s. Grace period until %s.",
            subscription.organization_id,
            grace_end.isoformat(),
        )
        await self._send_payment_failure_email(subscription, grace_end)

    async def _get_org_owner_email(self, organization_id) -> Optional[str]:
        """Look up the org owner's email address.

        Queries the users table for the user with role='owner' in the org.

        Args:
            organization_id: The organization UUID.

        Returns:
            The owner's email or None if not found.
        """
        query = (
            select(User)
            .where(
                User.organization_id == organization_id,
                User.role == "owner",
            )
        )
        # Apply soft-delete filter if available
        if hasattr(User, "deleted_at"):
            query = query.where(User.deleted_at.is_(None))

        result = await self.session.execute(query)
        owner = result.scalar_one_or_none()
        if owner:
            return owner.email
        return None

    async def _send_payment_failure_email(
        self, subscription: Subscription, grace_period_end: datetime
    ) -> None:
        """Send a payment failure notification email to the org owner.

        Sends via Resend within 24 hours of payment failure, informing the
        owner about the 7-day grace period and what happens when it expires.

        Args:
            subscription: The subscription that failed payment.
            grace_period_end: When the grace period expires.
        """
        try:
            import resend

            settings = get_settings()
            resend.api_key = settings.resend_api_key

            # Look up the org owner's email
            owner_email = await self._get_org_owner_email(subscription.organization_id)
            if not owner_email:
                logger.warning(
                    "No owner found for org %s; cannot send payment failure email",
                    subscription.organization_id,
                )
                return

            grace_end_formatted = grace_period_end.strftime("%B %d, %Y")

            subject = "Action Required: Payment Failed for Your Alignli Subscription"
            body = (
                f"Hi,\n\n"
                f"We were unable to process the payment for your Alignli subscription.\n\n"
                f"Your account will remain fully accessible during a 7-day grace period "
                f"ending on {grace_end_formatted}. Please update your payment method "
                f"before that date to avoid any disruption.\n\n"
                f"If payment is not resolved by {grace_end_formatted}, your account "
                f"will be switched to read-only mode. You will still be able to view "
                f"existing data, but new actions (uploading resumes, creating projects, "
                f"and AI analysis) will be blocked until payment is resolved.\n\n"
                f"To update your payment method, visit your billing settings in Alignli.\n\n"
                f"If you have any questions, reply to this email and our team will help.\n\n"
                f"— The Alignli Team"
            )

            resend.Emails.send(
                {
                    "from": settings.resend_from_email,
                    "to": [owner_email],
                    "subject": subject,
                    "text": body,
                }
            )

            logger.info(
                "Payment failure notification sent to %s for org %s",
                owner_email,
                subscription.organization_id,
            )

        except Exception as e:
            logger.error(
                "Failed to send payment failure email for org %s: %s",
                subscription.organization_id,
                str(e),
            )

    async def check_grace_period_expiry(self) -> list[Subscription]:
        """Check for subscriptions with expired grace periods and transition to read-only.

        Queries all subscriptions where:
        - status = 'grace_period'
        - grace_period_end < NOW()

        Transitions them to 'read_only' status, blocking all usage-consuming
        actions while preserving read access to existing data.

        Returns:
            List of subscriptions that were transitioned to read_only.
        """
        now = datetime.now(timezone.utc)

        # Query subscriptions with expired grace periods
        query = select(Subscription).where(
            Subscription.status == SubscriptionStatus.GRACE_PERIOD.value,
            Subscription.grace_period_end.isnot(None),
            Subscription.grace_period_end < now,
        )
        result = await self.session.execute(query)
        expired_subscriptions = list(result.scalars().all())

        transitioned: list[Subscription] = []
        for sub in expired_subscriptions:
            updated = await self.repository.update_status(
                subscription_id=sub.id,
                status=SubscriptionStatus.READ_ONLY.value,
            )
            if updated:
                transitioned.append(updated)
                logger.info(
                    "Subscription %s for org %s transitioned to read_only "
                    "(grace period expired at %s)",
                    sub.id,
                    sub.organization_id,
                    sub.grace_period_end,
                )

        return transitioned


# --- Helper Functions ---


def _resolve_plan_tier(plan_id: str) -> PlanTier:
    """Resolve a plan_id string to a PlanTier enum value."""
    try:
        return PlanTier(plan_id.lower())
    except ValueError:
        return PlanTier.STARTER


def _validate_upgrade(current: PlanTier, target: PlanTier) -> None:
    """Validate that the target plan is a valid upgrade from current."""
    current_idx = PLAN_ORDER.index(current)
    target_idx = PLAN_ORDER.index(target)

    if target_idx <= current_idx:
        raise ValidationException(
            message=f"Cannot upgrade from {current.value} to {target.value}. "
            "Target plan must be higher than current plan.",
            details=[
                {
                    "field": "target_plan",
                    "message": f"Must be higher than current plan ({current.value})",
                }
            ],
        )


def _validate_downgrade(current: PlanTier, target: PlanTier) -> None:
    """Validate that the target plan is a valid downgrade from current."""
    current_idx = PLAN_ORDER.index(current)
    target_idx = PLAN_ORDER.index(target)

    if target_idx >= current_idx:
        raise ValidationException(
            message=f"Cannot downgrade from {current.value} to {target.value}. "
            "Target plan must be lower than current plan.",
            details=[
                {
                    "field": "target_plan",
                    "message": f"Must be lower than current plan ({current.value})",
                }
            ],
        )


def _check_downgrade_warnings(target_limits: dict[str, int]) -> list[str]:
    """Check if current usage exceeds target plan limits.

    DEPRECATED: This standalone version is kept for backward compatibility.
    The BillingService now uses UsageTracker.get_downgrade_warnings() instead.
    """
    # Without async DB access, this returns empty.
    # The actual logic is in UsageTracker.get_downgrade_warnings().
    return []


def _get_stripe_price_id(plan: PlanTier) -> str:
    """Get the Stripe Price ID for a given plan tier.

    In production, these would be loaded from config or environment.
    """
    price_map = {
        PlanTier.STARTER: "price_starter",
        PlanTier.PROFESSIONAL: "price_professional",
        PlanTier.BUSINESS: "price_business",
        PlanTier.ENTERPRISE: "price_enterprise",
    }
    return price_map[plan]


def _stripe_plan_to_tier(stripe_sub: dict) -> str:
    """Extract the plan tier from a Stripe subscription object.

    Looks at the price/product metadata for the plan tier identifier.
    Falls back to 'starter' if not determinable.
    """
    try:
        items = stripe_sub.get("items", {}).get("data", [])
        if items:
            price = items[0].get("price", {})
            metadata = price.get("metadata", {})
            plan_tier = metadata.get("plan_tier", "starter")
            return plan_tier.lower()
    except (KeyError, IndexError, AttributeError):
        pass
    return "starter"


def _map_stripe_status(stripe_status: str) -> str:
    """Map Stripe subscription status to our internal status."""
    mapping = {
        "active": SubscriptionStatus.ACTIVE.value,
        "past_due": SubscriptionStatus.PAST_DUE.value,
        "canceled": SubscriptionStatus.CANCELED.value,
        "incomplete": SubscriptionStatus.INCOMPLETE.value,
        "trialing": SubscriptionStatus.TRIALING.value,
        "unpaid": SubscriptionStatus.READ_ONLY.value,
    }
    return mapping.get(stripe_status, SubscriptionStatus.ACTIVE.value)
