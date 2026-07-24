"""Usage tracking and threshold enforcement for billing.

Provides:
- UsageTracker class that queries DB for current usage metrics
- Threshold checks: warning at 80%, blocking at 100%
- Integration with BillingService.get_usage()

Tracked metrics:
- resume_reviews: Count of candidates with processing_status='completed' in current period
- active_projects: Count of non-archived hiring projects
- storage_mb: Total file sizes in candidate_documents (converted to MB)
- ai_credits: Count of AI responses in current billing period

Requirements: 17.2, 17.3, 17.4
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_current_org_id
from app.features.billing.schemas import PLAN_LIMITS, PlanTier, UsageMetric
from app.models.ai_responses import AIResponse
from app.models.candidate_documents import CandidateDocument
from app.models.candidates import Candidate
from app.models.hiring_projects import HiringProject

logger = logging.getLogger(__name__)

# Threshold constants
WARNING_THRESHOLD_PERCENT = 80.0
BLOCK_THRESHOLD_PERCENT = 100.0

# Bytes per megabyte for storage conversion
BYTES_PER_MB = 1024 * 1024


class UsageMetricName(str, Enum):
    """Tracked usage metric names matching PLAN_LIMITS keys."""

    RESUME_REVIEWS = "resume_reviews"
    ACTIVE_PROJECTS = "active_projects"
    STORAGE_MB = "storage_mb"
    AI_CREDITS = "ai_credits"


class UsageLimitStatus(str, Enum):
    """Result of checking a usage limit."""

    OK = "ok"
    WARNING = "warning"
    BLOCKED = "blocked"


@dataclass
class UsageCheckResult:
    """Result of checking usage against a plan limit."""

    metric: str
    used: int
    limit: int
    percentage: float
    status: UsageLimitStatus

    @property
    def is_blocked(self) -> bool:
        """Whether the action should be blocked."""
        return self.status == UsageLimitStatus.BLOCKED

    @property
    def is_at_warning(self) -> bool:
        """Whether usage is at warning threshold (>=80%)."""
        return self.status in (UsageLimitStatus.WARNING, UsageLimitStatus.BLOCKED)


class UsageTracker:
    """Tracks organization usage metrics against plan limits.

    Queries the database for current usage of:
    - Resume reviews (processed candidates in current billing period)
    - Active projects (non-archived hiring projects)
    - Storage usage (total file sizes in MB)
    - AI credits (AI responses in current billing period)

    Compares usage against PLAN_LIMITS to enforce thresholds:
    - Warning at 80% of plan limit
    - Block at 100% of plan limit (preserving read access)
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_current_usage(
        self,
        plan_tier: PlanTier,
        period_start: datetime,
        period_end: datetime,
    ) -> list[UsageMetric]:
        """Get all usage metrics for the current organization.

        Args:
            plan_tier: The organization's current plan tier.
            period_start: Start of the current billing period.
            period_end: End of the current billing period.

        Returns:
            List of UsageMetric objects with current values and limits.
        """
        limits = PLAN_LIMITS.get(plan_tier, PLAN_LIMITS[PlanTier.STARTER])
        org_id = get_current_org_id()

        resume_reviews = await self._count_resume_reviews(org_id, period_start, period_end)
        active_projects = await self._count_active_projects(org_id)
        storage_mb = await self._get_storage_usage_mb(org_id)
        ai_credits = await self._count_ai_credits(org_id, period_start, period_end)

        usage_values = {
            UsageMetricName.RESUME_REVIEWS: resume_reviews,
            UsageMetricName.ACTIVE_PROJECTS: active_projects,
            UsageMetricName.STORAGE_MB: storage_mb,
            UsageMetricName.AI_CREDITS: ai_credits,
        }

        metrics: list[UsageMetric] = []
        for metric_name, limit_value in limits.items():
            used = usage_values.get(UsageMetricName(metric_name), 0)
            percentage = _calculate_percentage(used, limit_value)
            at_warning = percentage >= WARNING_THRESHOLD_PERCENT
            at_limit = percentage >= BLOCK_THRESHOLD_PERCENT

            metrics.append(
                UsageMetric(
                    metric=metric_name,
                    used=used,
                    limit=limit_value,
                    percentage=percentage,
                    at_warning=at_warning,
                    at_limit=at_limit,
                )
            )

        return metrics

    async def check_usage_limit(
        self,
        metric: UsageMetricName,
        plan_tier: PlanTier,
        period_start: datetime,
        period_end: datetime,
    ) -> UsageCheckResult:
        """Check if a specific metric is within plan limits.

        Use this before performing usage-consuming actions to enforce limits.
        - Returns OK if under 80%
        - Returns WARNING if between 80% and 99%
        - Returns BLOCKED if at or exceeding 100%

        Args:
            metric: The usage metric to check.
            plan_tier: The organization's current plan tier.
            period_start: Start of the current billing period.
            period_end: End of the current billing period.

        Returns:
            UsageCheckResult with current status and values.
        """
        limits = PLAN_LIMITS.get(plan_tier, PLAN_LIMITS[PlanTier.STARTER])
        limit_value = limits.get(metric.value, 0)
        org_id = get_current_org_id()

        # Unlimited plans never block
        if limit_value == -1:
            return UsageCheckResult(
                metric=metric.value,
                used=0,
                limit=-1,
                percentage=0.0,
                status=UsageLimitStatus.OK,
            )

        used = await self._get_metric_value(metric, org_id, period_start, period_end)
        percentage = _calculate_percentage(used, limit_value)

        if percentage >= BLOCK_THRESHOLD_PERCENT:
            status = UsageLimitStatus.BLOCKED
        elif percentage >= WARNING_THRESHOLD_PERCENT:
            status = UsageLimitStatus.WARNING
        else:
            status = UsageLimitStatus.OK

        return UsageCheckResult(
            metric=metric.value,
            used=used,
            limit=limit_value,
            percentage=percentage,
            status=status,
        )

    async def get_downgrade_warnings(
        self,
        target_plan: PlanTier,
        period_start: datetime,
        period_end: datetime,
    ) -> list[str]:
        """Check if current usage exceeds target plan limits.

        Used during plan downgrade to warn users about metrics
        that would exceed the lower plan's limits.

        Args:
            target_plan: The target plan to downgrade to.
            period_start: Current billing period start.
            period_end: Current billing period end.

        Returns:
            List of warning messages for metrics exceeding limits.
        """
        target_limits = PLAN_LIMITS[target_plan]
        org_id = get_current_org_id()

        warnings: list[str] = []

        resume_reviews = await self._count_resume_reviews(org_id, period_start, period_end)
        active_projects = await self._count_active_projects(org_id)
        storage_mb = await self._get_storage_usage_mb(org_id)
        ai_credits = await self._count_ai_credits(org_id, period_start, period_end)

        usage_map = {
            "resume_reviews": (resume_reviews, "resume reviews"),
            "active_projects": (active_projects, "active projects"),
            "storage_mb": (storage_mb, "storage (MB)"),
            "ai_credits": (ai_credits, "AI credits"),
        }

        for metric_key, (used, label) in usage_map.items():
            limit = target_limits.get(metric_key, 0)
            if limit != -1 and used > limit:
                warnings.append(
                    f"Current {label} usage ({used}) exceeds "
                    f"{target_plan.value} plan limit ({limit})"
                )

        return warnings

    # --- Private query methods ---

    async def _get_metric_value(
        self,
        metric: UsageMetricName,
        org_id: Optional[str],
        period_start: datetime,
        period_end: datetime,
    ) -> int:
        """Get the current value for a specific metric."""
        if metric == UsageMetricName.RESUME_REVIEWS:
            return await self._count_resume_reviews(org_id, period_start, period_end)
        elif metric == UsageMetricName.ACTIVE_PROJECTS:
            return await self._count_active_projects(org_id)
        elif metric == UsageMetricName.STORAGE_MB:
            return await self._get_storage_usage_mb(org_id)
        elif metric == UsageMetricName.AI_CREDITS:
            return await self._count_ai_credits(org_id, period_start, period_end)
        return 0

    async def _count_resume_reviews(
        self,
        org_id: Optional[str],
        period_start: datetime,
        period_end: datetime,
    ) -> int:
        """Count processed candidates in the current billing period.

        A resume review is counted when a candidate's processing completes
        (processing_status = 'completed') during the billing period.
        """
        query = (
            select(func.count())
            .select_from(Candidate)
            .where(
                Candidate.organization_id == org_id,
                Candidate.processing_status == "completed",
                Candidate.created_at >= period_start,
                Candidate.created_at < period_end,
                Candidate.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(query)
        return result.scalar() or 0

    async def _count_active_projects(self, org_id: Optional[str]) -> int:
        """Count non-archived hiring projects for the organization.

        Active projects include all states except 'archived'.
        """
        query = (
            select(func.count())
            .select_from(HiringProject)
            .where(
                HiringProject.organization_id == org_id,
                HiringProject.state != "archived",
                HiringProject.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(query)
        return result.scalar() or 0

    async def _get_storage_usage_mb(self, org_id: Optional[str]) -> int:
        """Get total storage usage in MB (rounded up).

        Sums file_size_bytes from all candidate_documents for the org.
        """
        query = (
            select(func.coalesce(func.sum(CandidateDocument.file_size_bytes), 0))
            .where(
                CandidateDocument.organization_id == org_id,
                CandidateDocument.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(query)
        total_bytes = result.scalar() or 0
        # Convert to MB, rounding up to be conservative
        return (total_bytes + BYTES_PER_MB - 1) // BYTES_PER_MB if total_bytes > 0 else 0

    async def _count_ai_credits(
        self,
        org_id: Optional[str],
        period_start: datetime,
        period_end: datetime,
    ) -> int:
        """Count AI responses in the current billing period.

        Each AI API call in the period counts as one credit.
        """
        query = (
            select(func.count())
            .select_from(AIResponse)
            .where(
                AIResponse.organization_id == org_id,
                AIResponse.created_at >= period_start,
                AIResponse.created_at < period_end,
            )
        )
        result = await self.session.execute(query)
        return result.scalar() or 0


def _calculate_percentage(used: int, limit: int) -> float:
    """Calculate usage percentage.

    Returns 0.0 for unlimited plans (limit == -1) or zero limits.
    """
    if limit <= 0:
        return 0.0
    return round((used / limit) * 100, 1)
