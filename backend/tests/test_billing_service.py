"""Tests for Billing service logic.

Tests cover:
- Plan retrieval
- Plan upgrade validation
- Plan downgrade validation with warnings
- Webhook handling for subscription lifecycle
- Payment failure flow (grace period, status transitions)

All Stripe API calls are mocked.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.features.billing.schemas import (
    PLAN_LIMITS,
    PlanTier,
    SubscriptionStatus,
)
from app.features.billing.service import (
    GRACE_PERIOD_DAYS,
    BillingService,
    _check_downgrade_warnings,
    _map_stripe_status,
    _resolve_plan_tier,
    _stripe_plan_to_tier,
    _validate_downgrade,
    _validate_upgrade,
)
from app.core.security.exceptions import (
    ConflictException,
    NotFoundException,
    ValidationException,
)


# --- Helper: Create mock subscription ---


def _make_subscription(
    plan_id: str = "professional",
    status: str = "active",
    stripe_customer_id: str = "cus_test123",
    stripe_subscription_id: str = "sub_test123",
    grace_period_end: datetime | None = None,
) -> MagicMock:
    """Create a mock Subscription object."""
    sub = MagicMock()
    sub.id = uuid.uuid4()
    sub.organization_id = uuid.uuid4()
    sub.plan_id = plan_id
    sub.status = status
    sub.stripe_customer_id = stripe_customer_id
    sub.stripe_subscription_id = stripe_subscription_id
    sub.current_period_start = datetime.now(timezone.utc) - timedelta(days=15)
    sub.current_period_end = datetime.now(timezone.utc) + timedelta(days=15)
    sub.grace_period_end = grace_period_end
    return sub


# --- Tests for helper functions ---


class TestResolvePlanTier:
    """Tests for _resolve_plan_tier helper."""

    def test_resolves_starter(self) -> None:
        assert _resolve_plan_tier("starter") == PlanTier.STARTER

    def test_resolves_professional(self) -> None:
        assert _resolve_plan_tier("professional") == PlanTier.PROFESSIONAL

    def test_resolves_business(self) -> None:
        assert _resolve_plan_tier("business") == PlanTier.BUSINESS

    def test_resolves_enterprise(self) -> None:
        assert _resolve_plan_tier("enterprise") == PlanTier.ENTERPRISE

    def test_resolves_case_insensitive(self) -> None:
        assert _resolve_plan_tier("Professional") == PlanTier.PROFESSIONAL

    def test_unknown_falls_back_to_starter(self) -> None:
        assert _resolve_plan_tier("unknown") == PlanTier.STARTER
        assert _resolve_plan_tier("") == PlanTier.STARTER


class TestValidateUpgrade:
    """Tests for _validate_upgrade helper."""

    def test_valid_upgrade_starter_to_professional(self) -> None:
        _validate_upgrade(PlanTier.STARTER, PlanTier.PROFESSIONAL)

    def test_valid_upgrade_starter_to_enterprise(self) -> None:
        _validate_upgrade(PlanTier.STARTER, PlanTier.ENTERPRISE)

    def test_valid_upgrade_professional_to_business(self) -> None:
        _validate_upgrade(PlanTier.PROFESSIONAL, PlanTier.BUSINESS)

    def test_invalid_upgrade_same_plan(self) -> None:
        with pytest.raises(ValidationException):
            _validate_upgrade(PlanTier.PROFESSIONAL, PlanTier.PROFESSIONAL)

    def test_invalid_upgrade_downward(self) -> None:
        with pytest.raises(ValidationException):
            _validate_upgrade(PlanTier.BUSINESS, PlanTier.STARTER)


class TestValidateDowngrade:
    """Tests for _validate_downgrade helper."""

    def test_valid_downgrade_enterprise_to_business(self) -> None:
        _validate_downgrade(PlanTier.ENTERPRISE, PlanTier.BUSINESS)

    def test_valid_downgrade_professional_to_starter(self) -> None:
        _validate_downgrade(PlanTier.PROFESSIONAL, PlanTier.STARTER)

    def test_invalid_downgrade_same_plan(self) -> None:
        with pytest.raises(ValidationException):
            _validate_downgrade(PlanTier.PROFESSIONAL, PlanTier.PROFESSIONAL)

    def test_invalid_downgrade_upward(self) -> None:
        with pytest.raises(ValidationException):
            _validate_downgrade(PlanTier.STARTER, PlanTier.PROFESSIONAL)


class TestMapStripeStatus:
    """Tests for _map_stripe_status helper."""

    def test_maps_active(self) -> None:
        assert _map_stripe_status("active") == SubscriptionStatus.ACTIVE.value

    def test_maps_past_due(self) -> None:
        assert _map_stripe_status("past_due") == SubscriptionStatus.PAST_DUE.value

    def test_maps_canceled(self) -> None:
        assert _map_stripe_status("canceled") == SubscriptionStatus.CANCELED.value

    def test_maps_incomplete(self) -> None:
        assert _map_stripe_status("incomplete") == SubscriptionStatus.INCOMPLETE.value

    def test_maps_trialing(self) -> None:
        assert _map_stripe_status("trialing") == SubscriptionStatus.TRIALING.value

    def test_maps_unpaid_to_read_only(self) -> None:
        assert _map_stripe_status("unpaid") == SubscriptionStatus.READ_ONLY.value

    def test_unknown_defaults_to_active(self) -> None:
        assert _map_stripe_status("something_else") == SubscriptionStatus.ACTIVE.value


class TestStripePlanToTier:
    """Tests for _stripe_plan_to_tier helper."""

    def test_extracts_plan_from_metadata(self) -> None:
        stripe_sub = {
            "items": {
                "data": [
                    {
                        "price": {
                            "metadata": {"plan_tier": "professional"},
                        }
                    }
                ]
            }
        }
        assert _stripe_plan_to_tier(stripe_sub) == "professional"

    def test_falls_back_to_starter_on_missing_items(self) -> None:
        stripe_sub = {"items": {"data": []}}
        assert _stripe_plan_to_tier(stripe_sub) == "starter"

    def test_falls_back_to_starter_on_missing_metadata(self) -> None:
        stripe_sub = {"items": {"data": [{"price": {}}]}}
        assert _stripe_plan_to_tier(stripe_sub) == "starter"

    def test_falls_back_to_starter_on_malformed(self) -> None:
        assert _stripe_plan_to_tier({}) == "starter"


# --- Tests for BillingService ---


class TestBillingServiceGetPlan:
    """Tests for BillingService.get_current_plan."""

    @pytest.mark.asyncio
    async def test_returns_plan_with_limits(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        sub = _make_subscription(plan_id="professional")
        service.repository.get_by_organization = AsyncMock(return_value=sub)

        result = await service.get_current_plan()

        assert result.plan_id == "professional"
        assert result.status == "active"
        assert result.limits == PLAN_LIMITS[PlanTier.PROFESSIONAL]

    @pytest.mark.asyncio
    async def test_raises_not_found_when_no_subscription(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()
        service.repository.get_by_organization = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await service.get_current_plan()


class TestBillingServiceGetUsage:
    """Tests for BillingService.get_usage."""

    @pytest.mark.asyncio
    async def test_returns_usage_metrics(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()
        service.usage_tracker = AsyncMock()

        sub = _make_subscription(plan_id="starter")
        service.repository.get_by_organization = AsyncMock(return_value=sub)

        # Mock usage tracker to return zero-usage metrics
        from app.features.billing.schemas import UsageMetric

        mock_metrics = [
            UsageMetric(metric="resume_reviews", used=0, limit=50, percentage=0.0, at_warning=False, at_limit=False),
            UsageMetric(metric="active_projects", used=0, limit=3, percentage=0.0, at_warning=False, at_limit=False),
            UsageMetric(metric="storage_mb", used=0, limit=500, percentage=0.0, at_warning=False, at_limit=False),
            UsageMetric(metric="ai_credits", used=0, limit=100, percentage=0.0, at_warning=False, at_limit=False),
        ]
        service.usage_tracker.get_current_usage = AsyncMock(return_value=mock_metrics)

        result = await service.get_usage()

        assert result.plan_id == "starter"
        assert len(result.metrics) == 4  # resume_reviews, active_projects, storage_mb, ai_credits
        for metric in result.metrics:
            assert metric.used == 0
            assert metric.at_warning is False
            assert metric.at_limit is False


class TestBillingServiceUpgrade:
    """Tests for BillingService.upgrade_plan."""

    @pytest.mark.asyncio
    @patch("app.features.billing.service.stripe")
    async def test_successful_upgrade(self, mock_stripe: MagicMock) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        sub = _make_subscription(plan_id="starter")
        service.repository.get_by_organization = AsyncMock(return_value=sub)
        service.repository.update_plan = AsyncMock(return_value=sub)

        mock_stripe.Subscription.retrieve.return_value = {
            "items": {"data": [{"id": "si_123"}]}
        }
        mock_stripe.Subscription.modify.return_value = {}
        mock_stripe.StripeError = Exception

        result = await service.upgrade_plan(PlanTier.PROFESSIONAL)

        assert result.success is True
        assert result.new_plan == "professional"
        assert result.effective_immediately is True

    @pytest.mark.asyncio
    async def test_upgrade_rejects_lower_plan(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        sub = _make_subscription(plan_id="business")
        service.repository.get_by_organization = AsyncMock(return_value=sub)

        with pytest.raises(ValidationException):
            await service.upgrade_plan(PlanTier.STARTER)

    @pytest.mark.asyncio
    async def test_upgrade_no_subscription_raises(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()
        service.repository.get_by_organization = AsyncMock(return_value=None)

        with pytest.raises(NotFoundException):
            await service.upgrade_plan(PlanTier.PROFESSIONAL)


class TestBillingServiceDowngrade:
    """Tests for BillingService.downgrade_plan."""

    @pytest.mark.asyncio
    @patch("app.features.billing.service.stripe")
    async def test_successful_downgrade(self, mock_stripe: MagicMock) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()
        service.usage_tracker = AsyncMock()

        sub = _make_subscription(plan_id="professional")
        service.repository.get_by_organization = AsyncMock(return_value=sub)
        service.repository.update_plan = AsyncMock(return_value=sub)
        service.usage_tracker.get_downgrade_warnings = AsyncMock(return_value=[])

        mock_stripe.Subscription.retrieve.return_value = {
            "items": {"data": [{"id": "si_123"}]}
        }
        mock_stripe.Subscription.modify.return_value = {}
        mock_stripe.StripeError = Exception

        result = await service.downgrade_plan(
            PlanTier.STARTER, acknowledge_warnings=True
        )

        assert result.success is True
        assert result.new_plan == "starter"
        assert result.effective_at_cycle_end is True

    @pytest.mark.asyncio
    async def test_downgrade_rejects_higher_plan(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        sub = _make_subscription(plan_id="starter")
        service.repository.get_by_organization = AsyncMock(return_value=sub)

        with pytest.raises(ValidationException):
            await service.downgrade_plan(PlanTier.PROFESSIONAL)


class TestBillingServiceWebhookPaymentFailed:
    """Tests for payment failure webhook handling."""

    @pytest.mark.asyncio
    async def test_payment_failed_sets_grace_period(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        sub = _make_subscription()
        service.repository.get_by_stripe_customer_id = AsyncMock(return_value=sub)
        service.repository.update_status = AsyncMock(return_value=sub)
        service._send_payment_failure_email = AsyncMock()

        invoice = {"customer": "cus_test123"}
        await service._handle_payment_failed(invoice)

        # Verify update_status was called with grace_period status
        service.repository.update_status.assert_called_once()
        call_kwargs = service.repository.update_status.call_args[1]
        assert call_kwargs["status"] == SubscriptionStatus.GRACE_PERIOD.value
        assert call_kwargs["grace_period_end"] is not None

        # Verify grace period is ~7 days from now
        grace_end = call_kwargs["grace_period_end"]
        expected_end = datetime.now(timezone.utc) + timedelta(days=GRACE_PERIOD_DAYS)
        assert abs((grace_end - expected_end).total_seconds()) < 5

        # Verify email was sent
        service._send_payment_failure_email.assert_called_once()

    @pytest.mark.asyncio
    async def test_payment_failed_unknown_customer_no_error(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()
        service.repository.get_by_stripe_customer_id = AsyncMock(return_value=None)

        invoice = {"customer": "cus_unknown"}
        # Should not raise
        await service._handle_payment_failed(invoice)

    @pytest.mark.asyncio
    async def test_payment_failed_missing_customer_id(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        invoice = {}
        # Should not raise
        await service._handle_payment_failed(invoice)


class TestSendPaymentFailureEmail:
    """Tests for _send_payment_failure_email with org owner lookup."""

    @pytest.mark.asyncio
    @patch("app.features.billing.service.get_settings")
    async def test_sends_email_to_org_owner(self, mock_get_settings: MagicMock) -> None:
        """Test that payment failure email is sent to the org owner via Resend."""
        mock_settings = MagicMock()
        mock_settings.resend_api_key = "re_test_key"
        mock_settings.resend_from_email = "noreply@alignli.com"
        mock_get_settings.return_value = mock_settings

        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        # Mock org owner email lookup
        service._get_org_owner_email = AsyncMock(return_value="owner@example.com")

        sub = _make_subscription()
        grace_end = datetime.now(timezone.utc) + timedelta(days=7)

        with patch("resend.Emails.send") as mock_resend_send:
            await service._send_payment_failure_email(sub, grace_end)

            mock_resend_send.assert_called_once()
            call_args = mock_resend_send.call_args[0][0]
            assert call_args["to"] == ["owner@example.com"]
            assert "Payment Failed" in call_args["subject"]
            assert "7-day grace period" in call_args["text"]
            assert "read-only" in call_args["text"]

    @pytest.mark.asyncio
    @patch("app.features.billing.service.get_settings")
    async def test_no_email_when_no_owner_found(self, mock_get_settings: MagicMock) -> None:
        """Test that no email is sent when org owner cannot be found."""
        mock_settings = MagicMock()
        mock_settings.resend_api_key = "re_test_key"
        mock_settings.resend_from_email = "noreply@alignli.com"
        mock_get_settings.return_value = mock_settings

        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        # Mock org owner email lookup returning None
        service._get_org_owner_email = AsyncMock(return_value=None)

        sub = _make_subscription()
        grace_end = datetime.now(timezone.utc) + timedelta(days=7)

        with patch("resend.Emails.send") as mock_resend_send:
            await service._send_payment_failure_email(sub, grace_end)

            # Email should not be sent
            mock_resend_send.assert_not_called()

    @pytest.mark.asyncio
    @patch("app.features.billing.service.get_settings")
    async def test_email_failure_does_not_raise(self, mock_get_settings: MagicMock) -> None:
        """Test that a Resend failure is logged but does not crash the webhook."""
        mock_settings = MagicMock()
        mock_settings.resend_api_key = "re_test_key"
        mock_settings.resend_from_email = "noreply@alignli.com"
        mock_get_settings.return_value = mock_settings

        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        service._get_org_owner_email = AsyncMock(return_value="owner@example.com")

        sub = _make_subscription()
        grace_end = datetime.now(timezone.utc) + timedelta(days=7)

        with patch("resend.Emails.send", side_effect=Exception("Resend API error")):
            # Should not raise
            await service._send_payment_failure_email(sub, grace_end)


class TestGetOrgOwnerEmail:
    """Tests for _get_org_owner_email."""

    @pytest.mark.asyncio
    async def test_returns_owner_email(self) -> None:
        """Test that org owner email is retrieved correctly."""
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        # Mock the query result
        mock_owner = MagicMock()
        mock_owner.email = "owner@company.com"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_owner
        mock_session.execute = AsyncMock(return_value=mock_result)

        org_id = uuid.uuid4()
        email = await service._get_org_owner_email(org_id)

        assert email == "owner@company.com"
        mock_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_none_when_no_owner(self) -> None:
        """Test that None is returned when no owner user exists."""
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        org_id = uuid.uuid4()
        email = await service._get_org_owner_email(org_id)

        assert email is None


class TestCheckGracePeriodExpiry:
    """Tests for check_grace_period_expiry."""

    @pytest.mark.asyncio
    async def test_transitions_expired_subscriptions_to_read_only(self) -> None:
        """Test that expired grace period subscriptions are set to read_only."""
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        # Create two expired grace period subscriptions
        sub1 = _make_subscription(
            status="grace_period",
            grace_period_end=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        sub2 = _make_subscription(
            status="grace_period",
            grace_period_end=datetime.now(timezone.utc) - timedelta(days=1),
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sub1, sub2]
        mock_session.execute = AsyncMock(return_value=mock_result)

        # update_status returns the updated sub
        service.repository.update_status = AsyncMock(side_effect=[sub1, sub2])

        result = await service.check_grace_period_expiry()

        assert len(result) == 2
        assert service.repository.update_status.call_count == 2

        # Verify each was transitioned to read_only
        for call in service.repository.update_status.call_args_list:
            assert call[1]["status"] == SubscriptionStatus.READ_ONLY.value

    @pytest.mark.asyncio
    async def test_no_transitions_when_none_expired(self) -> None:
        """Test that nothing happens when no grace periods have expired."""
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await service.check_grace_period_expiry()

        assert len(result) == 0
        service.repository.update_status.assert_not_called()


class TestBillingServiceWebhookSubscriptionCreated:
    """Tests for subscription created webhook handling."""

    @pytest.mark.asyncio
    async def test_subscription_created_updates_local_record(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        sub = _make_subscription()
        service.repository.get_by_stripe_customer_id = AsyncMock(return_value=sub)
        service.repository.update = AsyncMock(return_value=sub)

        stripe_sub = {
            "id": "sub_new_123",
            "customer": "cus_test123",
            "current_period_start": int(datetime.now(timezone.utc).timestamp()),
            "current_period_end": int(
                (datetime.now(timezone.utc) + timedelta(days=30)).timestamp()
            ),
            "items": {
                "data": [
                    {"price": {"metadata": {"plan_tier": "business"}}}
                ]
            },
        }

        await service._handle_subscription_created(stripe_sub)

        service.repository.update.assert_called_once()
        call_kwargs = service.repository.update.call_args[1]
        assert call_kwargs["stripe_subscription_id"] == "sub_new_123"
        assert call_kwargs["plan_id"] == "business"
        assert call_kwargs["status"] == SubscriptionStatus.ACTIVE.value


class TestBillingServiceWebhookSubscriptionCanceled:
    """Tests for subscription canceled webhook handling."""

    @pytest.mark.asyncio
    async def test_subscription_canceled_updates_status(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        sub = _make_subscription()
        service.repository.get_by_stripe_subscription_id = AsyncMock(return_value=sub)
        service.repository.update_status = AsyncMock(return_value=sub)

        stripe_sub = {"id": "sub_test123"}
        await service._handle_subscription_canceled(stripe_sub)

        service.repository.update_status.assert_called_once_with(
            subscription_id=sub.id,
            status=SubscriptionStatus.CANCELED.value,
        )

    @pytest.mark.asyncio
    async def test_subscription_canceled_unknown_id_no_error(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()
        service.repository.get_by_stripe_subscription_id = AsyncMock(return_value=None)

        stripe_sub = {"id": "sub_unknown"}
        # Should not raise
        await service._handle_subscription_canceled(stripe_sub)


class TestBillingServiceWebhookRouter:
    """Tests for the webhook event router."""

    @pytest.mark.asyncio
    async def test_handle_webhook_routes_subscription_created(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()
        service._handle_subscription_created = AsyncMock()

        event = {
            "type": "customer.subscription.created",
            "data": {"object": {"id": "sub_123", "customer": "cus_123"}},
        }
        await service.handle_webhook_event(event)
        service._handle_subscription_created.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_webhook_routes_payment_failed(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()
        service._handle_payment_failed = AsyncMock()

        event = {
            "type": "invoice.payment_failed",
            "data": {"object": {"customer": "cus_123"}},
        }
        await service.handle_webhook_event(event)
        service._handle_payment_failed.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_webhook_routes_subscription_updated(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()
        service._handle_subscription_updated = AsyncMock()

        event = {
            "type": "customer.subscription.updated",
            "data": {"object": {"id": "sub_123"}},
        }
        await service.handle_webhook_event(event)
        service._handle_subscription_updated.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_webhook_routes_subscription_deleted(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()
        service._handle_subscription_canceled = AsyncMock()

        event = {
            "type": "customer.subscription.deleted",
            "data": {"object": {"id": "sub_123"}},
        }
        await service.handle_webhook_event(event)
        service._handle_subscription_canceled.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_webhook_unhandled_event_no_error(self) -> None:
        mock_session = AsyncMock()
        service = BillingService.__new__(BillingService)
        service.session = mock_session
        service.repository = AsyncMock()

        event = {
            "type": "checkout.session.completed",
            "data": {"object": {}},
        }
        # Should not raise
        await service.handle_webhook_event(event)


class TestPlanLimitsConfiguration:
    """Tests for plan limits configuration."""

    def test_all_plans_have_limits(self) -> None:
        for plan in PlanTier:
            assert plan in PLAN_LIMITS

    def test_limits_increase_with_tier(self) -> None:
        starter = PLAN_LIMITS[PlanTier.STARTER]
        professional = PLAN_LIMITS[PlanTier.PROFESSIONAL]
        business = PLAN_LIMITS[PlanTier.BUSINESS]

        assert professional["resume_reviews"] > starter["resume_reviews"]
        assert business["resume_reviews"] > professional["resume_reviews"]
        assert professional["active_projects"] > starter["active_projects"]
        assert business["active_projects"] > professional["active_projects"]

    def test_enterprise_has_unlimited(self) -> None:
        enterprise = PLAN_LIMITS[PlanTier.ENTERPRISE]
        for value in enterprise.values():
            assert value == -1  # unlimited
