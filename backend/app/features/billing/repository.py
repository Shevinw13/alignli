"""Repository for Billing / Subscription data access.

Provides database operations for the subscriptions table,
scoped to the current organization.

Requirements: 17.1, 17.7, 17.8
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.repository import BaseRepository
from app.core.database.session import get_current_org_id
from app.models.subscriptions import Subscription


class SubscriptionRepository(BaseRepository[Subscription]):
    """Repository for subscription operations."""

    model = Subscription

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_organization(self, organization_id: Optional[UUID] = None) -> Optional[Subscription]:
        """Get the subscription for the current organization.

        Args:
            organization_id: Explicit org ID. If None, uses the current session org.

        Returns:
            The Subscription record or None.
        """
        org_id = str(organization_id) if organization_id else get_current_org_id()
        if not org_id:
            return None

        query = select(self.model).where(
            self.model.organization_id == org_id
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def update_status(
        self,
        subscription_id: UUID,
        status: str,
        grace_period_end: Optional[datetime] = None,
    ) -> Optional[Subscription]:
        """Update subscription status and optional grace period.

        Args:
            subscription_id: UUID of the subscription to update.
            status: New subscription status.
            grace_period_end: Optional grace period end timestamp.

        Returns:
            Updated Subscription or None if not found.
        """
        kwargs: dict = {"status": status}
        if grace_period_end is not None:
            kwargs["grace_period_end"] = grace_period_end
        return await self.update(subscription_id, **kwargs)

    async def update_plan(
        self,
        subscription_id: UUID,
        plan_id: str,
        stripe_subscription_id: Optional[str] = None,
        current_period_start: Optional[datetime] = None,
        current_period_end: Optional[datetime] = None,
    ) -> Optional[Subscription]:
        """Update subscription plan details.

        Args:
            subscription_id: UUID of the subscription to update.
            plan_id: New plan identifier.
            stripe_subscription_id: Updated Stripe subscription ID if changed.
            current_period_start: New period start if applicable.
            current_period_end: New period end if applicable.

        Returns:
            Updated Subscription or None if not found.
        """
        kwargs: dict = {"plan_id": plan_id}
        if stripe_subscription_id is not None:
            kwargs["stripe_subscription_id"] = stripe_subscription_id
        if current_period_start is not None:
            kwargs["current_period_start"] = current_period_start
        if current_period_end is not None:
            kwargs["current_period_end"] = current_period_end
        return await self.update(subscription_id, **kwargs)

    async def get_by_stripe_subscription_id(
        self, stripe_subscription_id: str
    ) -> Optional[Subscription]:
        """Find a subscription by its Stripe subscription ID.

        Used by webhook handlers to look up the local subscription.

        Args:
            stripe_subscription_id: The Stripe subscription ID.

        Returns:
            The Subscription record or None.
        """
        query = select(self.model).where(
            self.model.stripe_subscription_id == stripe_subscription_id
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_stripe_customer_id(
        self, stripe_customer_id: str
    ) -> Optional[Subscription]:
        """Find a subscription by its Stripe customer ID.

        Used by webhook handlers when subscription ID is not yet available.

        Args:
            stripe_customer_id: The Stripe customer ID.

        Returns:
            The Subscription record or None.
        """
        query = select(self.model).where(
            self.model.stripe_customer_id == stripe_customer_id
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
