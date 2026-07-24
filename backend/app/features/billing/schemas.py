"""Pydantic schemas for Billing API.

Defines request/response models for subscription management,
plan upgrades/downgrades, and Stripe webhook events.

Requirements: 17.1, 17.5, 17.6, 17.7, 17.8
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PlanTier(str, Enum):
    """Subscription plan tiers."""

    STARTER = "starter"
    PROFESSIONAL = "professional"
    BUSINESS = "business"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, Enum):
    """Subscription status values."""

    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    INCOMPLETE = "incomplete"
    TRIALING = "trialing"
    GRACE_PERIOD = "grace_period"
    READ_ONLY = "read_only"


# --- Plan Configuration ---

PLAN_LIMITS = {
    PlanTier.STARTER: {
        "resume_reviews": 50,
        "active_projects": 3,
        "storage_mb": 500,
        "ai_credits": 100,
    },
    PlanTier.PROFESSIONAL: {
        "resume_reviews": 200,
        "active_projects": 10,
        "storage_mb": 2000,
        "ai_credits": 500,
    },
    PlanTier.BUSINESS: {
        "resume_reviews": 1000,
        "active_projects": 50,
        "storage_mb": 10000,
        "ai_credits": 2500,
    },
    PlanTier.ENTERPRISE: {
        "resume_reviews": -1,  # unlimited
        "active_projects": -1,
        "storage_mb": -1,
        "ai_credits": -1,
    },
}

# Plan ordering for upgrade/downgrade determination
PLAN_ORDER = [PlanTier.STARTER, PlanTier.PROFESSIONAL, PlanTier.BUSINESS, PlanTier.ENTERPRISE]


# --- Response Schemas ---


class PlanResponse(BaseModel):
    """Response schema for current subscription plan."""

    id: uuid.UUID
    organization_id: uuid.UUID
    plan_id: str
    status: str
    stripe_customer_id: str
    stripe_subscription_id: Optional[str] = None
    current_period_start: datetime
    current_period_end: datetime
    grace_period_end: Optional[datetime] = None
    limits: dict[str, int]

    model_config = {"from_attributes": True}


class UsageMetric(BaseModel):
    """A single usage metric with current value and limit."""

    metric: str
    used: int
    limit: int = Field(description="Plan limit. -1 means unlimited.")
    percentage: float = Field(description="Usage percentage (0-100). 0 if unlimited.")
    at_warning: bool = Field(description="True if usage >= 80% of limit")
    at_limit: bool = Field(description="True if usage >= 100% of limit")


class UsageResponse(BaseModel):
    """Response schema for usage metrics."""

    metrics: list[UsageMetric]
    plan_id: str


class UpgradeRequest(BaseModel):
    """Request schema to upgrade the subscription plan."""

    target_plan: PlanTier = Field(..., description="The plan tier to upgrade to")


class UpgradeResponse(BaseModel):
    """Response schema for plan upgrade."""

    success: bool
    message: str
    new_plan: str
    effective_immediately: bool = True


class DowngradeRequest(BaseModel):
    """Request schema to downgrade the subscription plan."""

    target_plan: PlanTier = Field(..., description="The plan tier to downgrade to")
    acknowledge_warnings: bool = Field(
        default=False,
        description="Must be true if current usage exceeds target plan limits",
    )


class DowngradeResponse(BaseModel):
    """Response schema for plan downgrade."""

    success: bool
    message: str
    new_plan: str
    effective_at_cycle_end: bool = True
    warnings: list[str] = Field(default_factory=list)


class BillingHistoryItem(BaseModel):
    """A single billing history entry."""

    id: str
    amount: int = Field(description="Amount in cents")
    currency: str
    status: str
    description: Optional[str] = None
    created: datetime


class BillingHistoryResponse(BaseModel):
    """Response schema for billing history."""

    items: list[BillingHistoryItem]
