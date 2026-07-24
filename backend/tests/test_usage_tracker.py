"""Tests for UsageTracker - usage tracking and threshold enforcement.

Tests cover:
- Usage metric calculations (resume reviews, active projects, storage, AI credits)
- Threshold checking: warning at 80%, block at 100%
- Unlimited plans never block
- Downgrade warnings when usage exceeds target plan limits
- Integration with BillingService.get_usage()

Requirements: 17.2, 17.3, 17.4
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.features.billing.schemas import PLAN_LIMITS, PlanTier, UsageMetric
from app.features.billing.usage import (
    BYTES_PER_MB,
    UsageCheckResult,
    UsageLimitStatus,
    UsageMetricName,
    UsageTracker,
    _calculate_percentage,
)


# --- Tests for _calculate_percentage ---


class TestCalculatePercentage:
    """Tests for the _calculate_percentage helper."""

    def test_zero_usage(self) -> None:
        assert _calculate_percentage(0, 100) == 0.0

    def test_half_usage(self) -> None:
        assert _calculate_percentage(50, 100) == 50.0

    def test_full_usage(self) -> None:
        assert _calculate_percentage(100, 100) == 100.0

    def test_over_limit(self) -> None:
        assert _calculate_percentage(150, 100) == 150.0

    def test_unlimited_returns_zero(self) -> None:
        assert _calculate_percentage(50, -1) == 0.0

    def test_zero_limit_returns_zero(self) -> None:
        assert _calculate_percentage(50, 0) == 0.0

    def test_rounding(self) -> None:
        # 33 / 100 = 33.0
        assert _calculate_percentage(33, 100) == 33.0
        # 1 / 3 = 33.3...
        assert _calculate_percentage(1, 3) == 33.3


# --- Tests for UsageCheckResult ---


class TestUsageCheckResult:
    """Tests for UsageCheckResult dataclass."""

    def test_ok_status(self) -> None:
        result = UsageCheckResult(
            metric="resume_reviews",
            used=10,
            limit=100,
            percentage=10.0,
            status=UsageLimitStatus.OK,
        )
        assert result.is_blocked is False
        assert result.is_at_warning is False

    def test_warning_status(self) -> None:
        result = UsageCheckResult(
            metric="resume_reviews",
            used=85,
            limit=100,
            percentage=85.0,
            status=UsageLimitStatus.WARNING,
        )
        assert result.is_blocked is False
        assert result.is_at_warning is True

    def test_blocked_status(self) -> None:
        result = UsageCheckResult(
            metric="resume_reviews",
            used=100,
            limit=100,
            percentage=100.0,
            status=UsageLimitStatus.BLOCKED,
        )
        assert result.is_blocked is True
        assert result.is_at_warning is True


# --- Tests for UsageTracker ---


class TestUsageTrackerCheckLimit:
    """Tests for UsageTracker.check_usage_limit."""

    @pytest.mark.asyncio
    async def test_ok_when_under_80_percent(self) -> None:
        mock_session = AsyncMock()
        tracker = UsageTracker(mock_session)

        # Mock _count_resume_reviews to return 30 (60% of starter 50 limit)
        tracker._count_resume_reviews = AsyncMock(return_value=30)

        period_start = datetime.now(timezone.utc) - timedelta(days=15)
        period_end = datetime.now(timezone.utc) + timedelta(days=15)

        result = await tracker.check_usage_limit(
            metric=UsageMetricName.RESUME_REVIEWS,
            plan_tier=PlanTier.STARTER,
            period_start=period_start,
            period_end=period_end,
        )

        assert result.status == UsageLimitStatus.OK
        assert result.used == 30
        assert result.limit == 50
        assert result.percentage == 60.0
        assert result.is_blocked is False
        assert result.is_at_warning is False

    @pytest.mark.asyncio
    async def test_warning_at_80_percent(self) -> None:
        mock_session = AsyncMock()
        tracker = UsageTracker(mock_session)

        # Mock: 40 of 50 = 80%
        tracker._count_resume_reviews = AsyncMock(return_value=40)

        period_start = datetime.now(timezone.utc) - timedelta(days=15)
        period_end = datetime.now(timezone.utc) + timedelta(days=15)

        result = await tracker.check_usage_limit(
            metric=UsageMetricName.RESUME_REVIEWS,
            plan_tier=PlanTier.STARTER,
            period_start=period_start,
            period_end=period_end,
        )

        assert result.status == UsageLimitStatus.WARNING
        assert result.percentage == 80.0
        assert result.is_at_warning is True
        assert result.is_blocked is False

    @pytest.mark.asyncio
    async def test_blocked_at_100_percent(self) -> None:
        mock_session = AsyncMock()
        tracker = UsageTracker(mock_session)

        # Mock: 50 of 50 = 100%
        tracker._count_resume_reviews = AsyncMock(return_value=50)

        period_start = datetime.now(timezone.utc) - timedelta(days=15)
        period_end = datetime.now(timezone.utc) + timedelta(days=15)

        result = await tracker.check_usage_limit(
            metric=UsageMetricName.RESUME_REVIEWS,
            plan_tier=PlanTier.STARTER,
            period_start=period_start,
            period_end=period_end,
        )

        assert result.status == UsageLimitStatus.BLOCKED
        assert result.percentage == 100.0
        assert result.is_blocked is True

    @pytest.mark.asyncio
    async def test_blocked_over_100_percent(self) -> None:
        mock_session = AsyncMock()
        tracker = UsageTracker(mock_session)

        # Mock: 60 of 50 = 120%
        tracker._count_resume_reviews = AsyncMock(return_value=60)

        period_start = datetime.now(timezone.utc) - timedelta(days=15)
        period_end = datetime.now(timezone.utc) + timedelta(days=15)

        result = await tracker.check_usage_limit(
            metric=UsageMetricName.RESUME_REVIEWS,
            plan_tier=PlanTier.STARTER,
            period_start=period_start,
            period_end=period_end,
        )

        assert result.status == UsageLimitStatus.BLOCKED
        assert result.percentage == 120.0
        assert result.is_blocked is True

    @pytest.mark.asyncio
    async def test_unlimited_plan_never_blocks(self) -> None:
        mock_session = AsyncMock()
        tracker = UsageTracker(mock_session)

        period_start = datetime.now(timezone.utc) - timedelta(days=15)
        period_end = datetime.now(timezone.utc) + timedelta(days=15)

        result = await tracker.check_usage_limit(
            metric=UsageMetricName.RESUME_REVIEWS,
            plan_tier=PlanTier.ENTERPRISE,
            period_start=period_start,
            period_end=period_end,
        )

        assert result.status == UsageLimitStatus.OK
        assert result.limit == -1
        assert result.percentage == 0.0
        assert result.is_blocked is False

    @pytest.mark.asyncio
    async def test_active_projects_check(self) -> None:
        mock_session = AsyncMock()
        tracker = UsageTracker(mock_session)

        # Starter limit is 3 active projects; mock 3 = 100% = blocked
        tracker._count_active_projects = AsyncMock(return_value=3)

        period_start = datetime.now(timezone.utc) - timedelta(days=15)
        period_end = datetime.now(timezone.utc) + timedelta(days=15)

        result = await tracker.check_usage_limit(
            metric=UsageMetricName.ACTIVE_PROJECTS,
            plan_tier=PlanTier.STARTER,
            period_start=period_start,
            period_end=period_end,
        )

        assert result.status == UsageLimitStatus.BLOCKED
        assert result.used == 3
        assert result.limit == 3

    @pytest.mark.asyncio
    async def test_storage_check(self) -> None:
        mock_session = AsyncMock()
        tracker = UsageTracker(mock_session)

        # Starter limit is 500 MB; mock 400 = 80% = warning
        tracker._get_storage_usage_mb = AsyncMock(return_value=400)

        period_start = datetime.now(timezone.utc) - timedelta(days=15)
        period_end = datetime.now(timezone.utc) + timedelta(days=15)

        result = await tracker.check_usage_limit(
            metric=UsageMetricName.STORAGE_MB,
            plan_tier=PlanTier.STARTER,
            period_start=period_start,
            period_end=period_end,
        )

        assert result.status == UsageLimitStatus.WARNING
        assert result.used == 400
        assert result.limit == 500

    @pytest.mark.asyncio
    async def test_ai_credits_check(self) -> None:
        mock_session = AsyncMock()
        tracker = UsageTracker(mock_session)

        # Starter limit is 100; mock 50 = 50% = OK
        tracker._count_ai_credits = AsyncMock(return_value=50)

        period_start = datetime.now(timezone.utc) - timedelta(days=15)
        period_end = datetime.now(timezone.utc) + timedelta(days=15)

        result = await tracker.check_usage_limit(
            metric=UsageMetricName.AI_CREDITS,
            plan_tier=PlanTier.STARTER,
            period_start=period_start,
            period_end=period_end,
        )

        assert result.status == UsageLimitStatus.OK
        assert result.used == 50
        assert result.limit == 100


class TestUsageTrackerGetCurrentUsage:
    """Tests for UsageTracker.get_current_usage."""

    @pytest.mark.asyncio
    @patch("app.features.billing.usage.get_current_org_id", return_value="org-123")
    async def test_returns_all_metrics(self, mock_org_id: MagicMock) -> None:
        mock_session = AsyncMock()
        tracker = UsageTracker(mock_session)

        tracker._count_resume_reviews = AsyncMock(return_value=25)
        tracker._count_active_projects = AsyncMock(return_value=2)
        tracker._get_storage_usage_mb = AsyncMock(return_value=100)
        tracker._count_ai_credits = AsyncMock(return_value=40)

        period_start = datetime.now(timezone.utc) - timedelta(days=15)
        period_end = datetime.now(timezone.utc) + timedelta(days=15)

        metrics = await tracker.get_current_usage(
            plan_tier=PlanTier.STARTER,
            period_start=period_start,
            period_end=period_end,
        )

        assert len(metrics) == 4

        metric_map = {m.metric: m for m in metrics}

        # resume_reviews: 25/50 = 50%
        assert metric_map["resume_reviews"].used == 25
        assert metric_map["resume_reviews"].limit == 50
        assert metric_map["resume_reviews"].percentage == 50.0
        assert metric_map["resume_reviews"].at_warning is False
        assert metric_map["resume_reviews"].at_limit is False

        # active_projects: 2/3 = 66.7%
        assert metric_map["active_projects"].used == 2
        assert metric_map["active_projects"].limit == 3
        assert metric_map["active_projects"].at_warning is False

        # storage_mb: 100/500 = 20%
        assert metric_map["storage_mb"].used == 100
        assert metric_map["storage_mb"].limit == 500
        assert metric_map["storage_mb"].at_warning is False

        # ai_credits: 40/100 = 40%
        assert metric_map["ai_credits"].used == 40
        assert metric_map["ai_credits"].limit == 100
        assert metric_map["ai_credits"].at_warning is False

    @pytest.mark.asyncio
    @patch("app.features.billing.usage.get_current_org_id", return_value="org-123")
    async def test_marks_warning_and_limit_correctly(self, mock_org_id: MagicMock) -> None:
        mock_session = AsyncMock()
        tracker = UsageTracker(mock_session)

        # Set usage at various thresholds for starter plan
        tracker._count_resume_reviews = AsyncMock(return_value=45)  # 90% of 50 -> warning
        tracker._count_active_projects = AsyncMock(return_value=3)  # 100% of 3 -> at limit
        tracker._get_storage_usage_mb = AsyncMock(return_value=200)  # 40% of 500 -> ok
        tracker._count_ai_credits = AsyncMock(return_value=80)  # 80% of 100 -> warning

        period_start = datetime.now(timezone.utc) - timedelta(days=15)
        period_end = datetime.now(timezone.utc) + timedelta(days=15)

        metrics = await tracker.get_current_usage(
            plan_tier=PlanTier.STARTER,
            period_start=period_start,
            period_end=period_end,
        )

        metric_map = {m.metric: m for m in metrics}

        assert metric_map["resume_reviews"].at_warning is True
        assert metric_map["resume_reviews"].at_limit is False

        assert metric_map["active_projects"].at_warning is True
        assert metric_map["active_projects"].at_limit is True

        assert metric_map["storage_mb"].at_warning is False
        assert metric_map["storage_mb"].at_limit is False

        assert metric_map["ai_credits"].at_warning is True
        assert metric_map["ai_credits"].at_limit is False


class TestUsageTrackerDowngradeWarnings:
    """Tests for UsageTracker.get_downgrade_warnings."""

    @pytest.mark.asyncio
    @patch("app.features.billing.usage.get_current_org_id", return_value="org-123")
    async def test_no_warnings_when_under_limits(self, mock_org_id: MagicMock) -> None:
        mock_session = AsyncMock()
        tracker = UsageTracker(mock_session)

        tracker._count_resume_reviews = AsyncMock(return_value=10)
        tracker._count_active_projects = AsyncMock(return_value=2)
        tracker._get_storage_usage_mb = AsyncMock(return_value=100)
        tracker._count_ai_credits = AsyncMock(return_value=30)

        period_start = datetime.now(timezone.utc) - timedelta(days=15)
        period_end = datetime.now(timezone.utc) + timedelta(days=15)

        warnings = await tracker.get_downgrade_warnings(
            target_plan=PlanTier.STARTER,
            period_start=period_start,
            period_end=period_end,
        )

        assert warnings == []

    @pytest.mark.asyncio
    @patch("app.features.billing.usage.get_current_org_id", return_value="org-123")
    async def test_warnings_when_over_target_limits(self, mock_org_id: MagicMock) -> None:
        mock_session = AsyncMock()
        tracker = UsageTracker(mock_session)

        # Current usage exceeds starter limits
        tracker._count_resume_reviews = AsyncMock(return_value=100)  # starter limit is 50
        tracker._count_active_projects = AsyncMock(return_value=5)  # starter limit is 3
        tracker._get_storage_usage_mb = AsyncMock(return_value=200)  # starter limit is 500 (ok)
        tracker._count_ai_credits = AsyncMock(return_value=50)  # starter limit is 100 (ok)

        period_start = datetime.now(timezone.utc) - timedelta(days=15)
        period_end = datetime.now(timezone.utc) + timedelta(days=15)

        warnings = await tracker.get_downgrade_warnings(
            target_plan=PlanTier.STARTER,
            period_start=period_start,
            period_end=period_end,
        )

        assert len(warnings) == 2
        assert any("resume reviews" in w for w in warnings)
        assert any("active projects" in w for w in warnings)


class TestBillingServiceGetUsageIntegration:
    """Tests for BillingService.get_usage() wired to UsageTracker."""

    @pytest.mark.asyncio
    async def test_get_usage_uses_tracker(self) -> None:
        """Verify BillingService.get_usage() delegates to UsageTracker."""
        from app.features.billing.service import BillingService

        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()
        service.usage_tracker = AsyncMock()

        # Create mock subscription
        sub = MagicMock()
        sub.id = uuid.uuid4()
        sub.organization_id = uuid.uuid4()
        sub.plan_id = "professional"
        sub.status = "active"
        sub.current_period_start = datetime.now(timezone.utc) - timedelta(days=15)
        sub.current_period_end = datetime.now(timezone.utc) + timedelta(days=15)

        service.repository.get_by_organization = AsyncMock(return_value=sub)

        # Mock usage tracker to return metrics
        mock_metrics = [
            UsageMetric(
                metric="resume_reviews",
                used=100,
                limit=200,
                percentage=50.0,
                at_warning=False,
                at_limit=False,
            ),
            UsageMetric(
                metric="active_projects",
                used=5,
                limit=10,
                percentage=50.0,
                at_warning=False,
                at_limit=False,
            ),
            UsageMetric(
                metric="storage_mb",
                used=500,
                limit=2000,
                percentage=25.0,
                at_warning=False,
                at_limit=False,
            ),
            UsageMetric(
                metric="ai_credits",
                used=200,
                limit=500,
                percentage=40.0,
                at_warning=False,
                at_limit=False,
            ),
        ]
        service.usage_tracker.get_current_usage = AsyncMock(return_value=mock_metrics)

        result = await service.get_usage()

        assert result.plan_id == "professional"
        assert len(result.metrics) == 4
        assert result.metrics[0].used == 100

        # Verify tracker was called with correct args
        service.usage_tracker.get_current_usage.assert_called_once_with(
            plan_tier=PlanTier.PROFESSIONAL,
            period_start=sub.current_period_start,
            period_end=sub.current_period_end,
        )
