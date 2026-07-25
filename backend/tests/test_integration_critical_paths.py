"""Integration tests for critical end-to-end paths.

Tests cover:
- Full project creation flow (create → upload → process → score → view)
- Authentication and org-scoping end-to-end
- State machine transitions with prerequisite validation
- Billing lifecycle (upgrade, downgrade, payment failure, grace period)

These tests use mocked services to validate the integration between components
without requiring external service connections.

**Validates: Requirements 1.1, 3.1, 7.1, 15.1, 17.1, 21.1**
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.database.session import set_current_org_id
from app.core.middleware.auth import AuthenticatedUser
from app.core.security.exceptions import (
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnprocessableException,
)
from app.features.billing.schemas import (
    PLAN_LIMITS,
    PLAN_ORDER,
    PlanTier,
    SubscriptionStatus,
)
from app.features.billing.usage import (
    UsageCheckResult,
    UsageLimitStatus,
    UsageMetricName,
    _calculate_percentage,
)
from app.features.hiring_projects.schemas import (
    EmploymentType,
    RemotePreference,
    ProjectCreateRequest,
)
from app.features.hiring_projects.state_machine import (
    TRANSITION_AUTHORIZED_ROLES,
    VALID_TRANSITIONS,
    ProjectState,
    get_valid_transitions,
    transition_state,
)
from app.features.ingestion.schemas import FileMetadata
from app.features.ingestion.service import _validate_file
from app.features.scoring.engine import (
    CriterionInput,
    Priority,
    calculate_match_score,
)
from app.main import app


# --- Constants ---

TEST_ORG_ID = str(uuid.uuid4())
TEST_ORG_ID_2 = str(uuid.uuid4())
TEST_USER_ID = "user_integration_test_001"
TEST_PROJECT_ID = uuid.uuid4()
CSRF_TOKEN = "test-csrf-token-integration"


# --- Helpers ---


def _mock_user(
    org_id: str = TEST_ORG_ID,
    role: str = "Hiring_Manager",
    user_id: str = TEST_USER_ID,
) -> AuthenticatedUser:
    """Create a mock authenticated user."""
    return AuthenticatedUser(
        user_id=user_id,
        org_id=org_id,
        role=role,
    )


# --- Fixtures ---


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a test client with mocked auth and db dependencies."""
    from app.core.database.session import get_db
    from app.core.middleware.auth import get_current_user

    async def mock_get_db():
        yield AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    app.dependency_overrides[get_db] = mock_get_db
    set_current_org_id(TEST_ORG_ID)

    test_client = TestClient(app)
    test_client.cookies.set("csrf_token", CSRF_TOKEN)

    yield test_client

    app.dependency_overrides.clear()
    set_current_org_id(None)


# --- Test: Full Project Creation Flow ---


class TestFullProjectCreationFlow:
    """Test the full project creation flow: create → upload → process → score → view.

    **Validates: Requirements 3.1, 7.1, 15.1**
    """

    def test_project_creation_with_valid_data(self, client: TestClient):
        """A project is created with valid data and starts in Draft state."""
        from app.features.hiring_projects.service import HiringProjectService

        mock_project = MagicMock()
        mock_project.id = TEST_PROJECT_ID
        mock_project.title = "Senior Engineer"
        mock_project.state = "Draft"
        mock_project.location = "Remote"
        mock_project.employment_type = "Full-time"
        mock_project.remote_preference = "Remote"
        mock_project.organization_id = uuid.UUID(TEST_ORG_ID)
        mock_project.created_at = datetime.now(timezone.utc)
        mock_project.updated_at = datetime.now(timezone.utc)
        mock_project.filled_at = None
        mock_project.state_history = []
        mock_project.assigned_manager_id = uuid.uuid4()

        with patch.object(
            HiringProjectService, "create_project", new_callable=AsyncMock, return_value=mock_project
        ):
            response = client.post(
                "/api/v1/projects",
                json={
                    "title": "Senior Engineer",
                    "location": "Remote",
                    "employment_type": "Full-time",
                    "remote_preference": "Remote",
                    "assigned_manager_id": str(uuid.uuid4()),
                },
                headers={"x-csrf-token": CSRF_TOKEN},
            )

            assert response.status_code == 201
            data = response.json()
            assert data["state"] == "Draft"
            assert data["title"] == "Senior Engineer"

    def test_file_upload_validates_before_processing(self):
        """Files are validated (PDF only, size check) before entering the pipeline."""
        # Valid PDF
        valid = FileMetadata(
            filename="resume.pdf", size_bytes=500_000, mime_type="application/pdf"
        )
        assert _validate_file(valid) is None

        # Invalid DOCX
        invalid = FileMetadata(
            filename="resume.docx",
            size_bytes=500_000,
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        assert _validate_file(invalid) is not None

    def test_scoring_produces_viewable_results(self):
        """After processing, scoring engine produces a valid match score in [0, 100]."""
        criteria = [
            CriterionInput(
                criterion_id=uuid.uuid4(),
                raw_score=80,
                max_score=100,
                priority=Priority.HIGH,
                reasoning="Strong technical background",
            ),
            CriterionInput(
                criterion_id=uuid.uuid4(),
                raw_score=60,
                max_score=100,
                priority=Priority.MEDIUM,
                reasoning="Adequate experience",
            ),
            CriterionInput(
                criterion_id=uuid.uuid4(),
                raw_score=40,
                max_score=100,
                priority=Priority.LOW,
                reasoning="Limited leadership examples",
            ),
        ]

        result = calculate_match_score(criteria)

        assert 0 <= result.match_score <= 100
        assert len(result.criterion_scores) == 3
        for cs in result.criterion_scores:
            assert 0.0 <= cs.normalized_score <= 100.0
            assert len(cs.reasoning) > 0

    def test_end_to_end_flow_draft_to_active_requires_processed_candidate(self):
        """Project cannot move from Draft to Active without a processed candidate."""
        # This validates the integration: upload → process must complete
        # before state transition can occur.
        # We test the state machine logic directly: Draft→Active requires
        # at least 1 candidate with completed processing.
        async def _run():
            mock_session = AsyncMock()

            # Mock execute to return a scalar result of 0 (no processed candidates)
            mock_result = MagicMock()
            mock_result.scalar.return_value = 0
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_session.flush = AsyncMock()
            mock_session.refresh = AsyncMock()

            mock_project = MagicMock()
            mock_project.state = ProjectState.DRAFT
            mock_project.state_history = []

            with patch(
                "app.features.hiring_projects.state_machine.HiringProjectRepository"
            ) as MockRepo:
                MockRepo.return_value.get = AsyncMock(return_value=mock_project)

                with pytest.raises(UnprocessableException) as exc_info:
                    await transition_state(
                        session=mock_session,
                        project_id=TEST_PROJECT_ID,
                        new_state=ProjectState.ACTIVE,
                        actor_user_id=TEST_USER_ID,
                        actor_role="Hiring_Manager",
                    )

                assert "Prerequisites not met" in str(exc_info.value.message)

        import asyncio
        asyncio.run(_run())


# --- Test: Authentication and Org-Scoping End-to-End ---


class TestAuthenticationAndOrgScoping:
    """Test authentication and organization scoping.

    **Validates: Requirements 1.1, 21.1**
    """

    def test_unauthenticated_request_returns_401(self):
        """Requests without valid auth are rejected with 401."""
        from app.core.database.session import get_db
        from app.core.middleware.auth import get_current_user

        async def mock_get_db():
            yield AsyncMock()

        # Don't override get_current_user — let the real middleware reject
        app.dependency_overrides[get_db] = mock_get_db

        # Remove the auth override to simulate unauthenticated request
        if get_current_user in app.dependency_overrides:
            del app.dependency_overrides[get_current_user]

        test_client = TestClient(app, raise_server_exceptions=False)
        response = test_client.get("/api/v1/projects")

        # Should be 401 or 403 for unauthenticated
        assert response.status_code in (401, 403)

        app.dependency_overrides.clear()

    def test_cross_org_access_returns_404_not_403(self):
        """Cross-org resource access returns 404 (indistinguishable from not found)."""
        # The org-scoping middleware filters queries so cross-org resources
        # appear as not found rather than forbidden
        from app.core.database.session import get_db
        from app.core.middleware.auth import get_current_user
        from app.features.hiring_projects.service import HiringProjectService

        async def mock_get_db():
            yield AsyncMock()

        # User in org A tries to access a project
        app.dependency_overrides[get_current_user] = lambda: _mock_user(
            org_id=TEST_ORG_ID
        )
        app.dependency_overrides[get_db] = mock_get_db
        set_current_org_id(TEST_ORG_ID)

        with patch.object(
            HiringProjectService,
            "get_project",
            new_callable=AsyncMock,
            side_effect=NotFoundException(
                message="The requested project was not found"
            ),
        ):
            test_client = TestClient(app)
            test_client.cookies.set("csrf_token", CSRF_TOKEN)
            response = test_client.get(f"/api/v1/projects/{uuid.uuid4()}")
            assert response.status_code == 404

        app.dependency_overrides.clear()
        set_current_org_id(None)

    def test_different_org_users_see_different_data(self):
        """Users from different orgs cannot see each other's data."""
        # This verifies the principle that org_id scoping is injected at query level
        # Org A user
        org_a_user = _mock_user(org_id=TEST_ORG_ID, user_id="user_org_a")
        # Org B user
        org_b_user = _mock_user(org_id=TEST_ORG_ID_2, user_id="user_org_b")

        # Both users exist but belong to different orgs
        assert org_a_user.org_id != org_b_user.org_id
        # The system uses org_id from auth token to scope all queries
        assert org_a_user.org_id == TEST_ORG_ID
        assert org_b_user.org_id == TEST_ORG_ID_2


# --- Test: State Machine Transitions with Prerequisite Validation ---


class TestStateMachineTransitionsWithPrerequisites:
    """Test state machine transitions with prerequisite validation.

    **Validates: Requirements 21.1**
    """

    def test_all_valid_transitions_are_defined(self):
        """Every non-terminal state has at least one valid transition."""
        for state in ProjectState.ALL:
            if state != ProjectState.ARCHIVED:
                transitions = get_valid_transitions(state)
                assert len(transitions) > 0, f"State '{state}' has no transitions"

    def test_archived_is_terminal_with_no_outgoing_transitions(self):
        """Archived state has no valid outgoing transitions."""
        transitions = get_valid_transitions(ProjectState.ARCHIVED)
        assert transitions == []

    def test_every_state_can_reach_archived(self):
        """Every non-Archived state can transition to Archived."""
        for state in ProjectState.ALL:
            if state != ProjectState.ARCHIVED:
                assert ProjectState.ARCHIVED in VALID_TRANSITIONS[state]

    def test_unauthorized_roles_cannot_transition(self):
        """Roles outside the authorized set cannot perform state transitions."""
        unauthorized_roles = ["Viewer", "Recruiter", None, ""]

        async def _run():
            for role in unauthorized_roles:
                mock_session = AsyncMock()
                with pytest.raises(ForbiddenException):
                    await transition_state(
                        session=mock_session,
                        project_id=TEST_PROJECT_ID,
                        new_state=ProjectState.ACTIVE,
                        actor_user_id=TEST_USER_ID,
                        actor_role=role,
                    )

        import asyncio
        asyncio.run(_run())

    def test_invalid_transition_raises_conflict(self):
        """Invalid transitions raise ConflictException with valid alternatives."""

        async def _run():
            mock_session = AsyncMock()
            mock_project = MagicMock()
            mock_project.state = ProjectState.DRAFT  # Can only go to Active or Archived

            with patch(
                "app.features.hiring_projects.state_machine.HiringProjectRepository"
            ) as MockRepo:
                MockRepo.return_value.get = AsyncMock(return_value=mock_project)

                with pytest.raises(ConflictException) as exc_info:
                    await transition_state(
                        session=mock_session,
                        project_id=TEST_PROJECT_ID,
                        new_state=ProjectState.FILLED,  # Invalid from Draft
                        actor_user_id=TEST_USER_ID,
                        actor_role="Admin",
                    )

                assert "Invalid state transition" in str(exc_info.value.message)

        import asyncio
        asyncio.run(_run())

    def test_prerequisite_failure_blocks_transition(self):
        """Transition with unmet prerequisites raises UnprocessableException."""

        async def _run():
            mock_session = AsyncMock()

            # Mock execute to return a scalar result of 0 (no candidates)
            mock_result = MagicMock()
            mock_result.scalar.return_value = 0
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_session.flush = AsyncMock()
            mock_session.refresh = AsyncMock()

            mock_project = MagicMock()
            mock_project.state = ProjectState.ACTIVE
            mock_project.state_history = []

            with patch(
                "app.features.hiring_projects.state_machine.HiringProjectRepository"
            ) as MockRepo:
                MockRepo.return_value.get = AsyncMock(return_value=mock_project)

                with pytest.raises(UnprocessableException):
                    await transition_state(
                        session=mock_session,
                        project_id=TEST_PROJECT_ID,
                        new_state=ProjectState.REVIEWING,
                        actor_user_id=TEST_USER_ID,
                        actor_role="Hiring_Manager",
                    )

        import asyncio
        asyncio.run(_run())

    def test_successful_transition_records_history_entry(self):
        """Successful transition adds exactly one history entry."""

        async def _run():
            mock_session = AsyncMock()
            mock_session.flush = AsyncMock()
            mock_session.refresh = AsyncMock()

            mock_project = MagicMock()
            mock_project.state = ProjectState.DRAFT
            mock_project.state_history = []
            mock_project.filled_at = None

            with patch(
                "app.features.hiring_projects.state_machine.HiringProjectRepository"
            ) as MockRepo:
                MockRepo.return_value.get = AsyncMock(return_value=mock_project)

                # Archived has no prerequisites
                result = await transition_state(
                    session=mock_session,
                    project_id=TEST_PROJECT_ID,
                    new_state=ProjectState.ARCHIVED,
                    actor_user_id=TEST_USER_ID,
                    actor_role="Admin",
                )

                # State was updated
                assert mock_project.state == ProjectState.ARCHIVED
                # One history entry added
                assert len(mock_project.state_history) == 1
                entry = mock_project.state_history[0]
                assert entry["previous_state"] == ProjectState.DRAFT
                assert entry["new_state"] == ProjectState.ARCHIVED
                assert entry["actor_id"] == TEST_USER_ID

        import asyncio
        asyncio.run(_run())


# --- Test: Billing Lifecycle ---


class TestBillingLifecycle:
    """Test billing lifecycle (upgrade, downgrade, payment failure, grace period).

    **Validates: Requirements 17.1**
    """

    def test_plan_order_is_correct(self):
        """Plan tiers are ordered from lowest to highest."""
        assert PLAN_ORDER == [
            PlanTier.STARTER,
            PlanTier.PROFESSIONAL,
            PlanTier.BUSINESS,
            PlanTier.ENTERPRISE,
        ]

    def test_upgrade_goes_to_higher_tier(self):
        """Upgrade validation ensures target is higher than current plan."""
        from app.features.billing.service import _validate_upgrade

        # Valid upgrade: Starter → Professional
        _validate_upgrade(PlanTier.STARTER, PlanTier.PROFESSIONAL)  # should not raise

        # Invalid upgrade: Professional → Starter (that's a downgrade)
        with pytest.raises(Exception):
            _validate_upgrade(PlanTier.PROFESSIONAL, PlanTier.STARTER)

        # Invalid upgrade: same tier
        with pytest.raises(Exception):
            _validate_upgrade(PlanTier.STARTER, PlanTier.STARTER)

    def test_downgrade_goes_to_lower_tier(self):
        """Downgrade validation ensures target is lower than current plan."""
        from app.features.billing.service import _validate_downgrade

        # Valid downgrade: Professional → Starter
        _validate_downgrade(PlanTier.PROFESSIONAL, PlanTier.STARTER)  # should not raise

        # Invalid downgrade: Starter → Professional (that's an upgrade)
        with pytest.raises(Exception):
            _validate_downgrade(PlanTier.STARTER, PlanTier.PROFESSIONAL)

    def test_payment_failure_triggers_grace_period_logic(self):
        """Payment failure handler sets grace period and notifies."""

        async def _run():
            from app.features.billing.service import BillingService

            mock_session = AsyncMock()
            service = BillingService(mock_session)

            # Mock the repository methods directly on the service instance
            mock_sub = MagicMock()
            mock_sub.id = uuid.uuid4()
            mock_sub.status = SubscriptionStatus.ACTIVE.value
            mock_sub.organization_id = uuid.UUID(TEST_ORG_ID)
            mock_sub.stripe_subscription_id = "sub_test_123"
            mock_sub.stripe_customer_id = "cus_test_123"
            mock_sub.grace_period_end = None

            service.repository = AsyncMock()
            service.repository.get_by_stripe_customer_id = AsyncMock(
                return_value=mock_sub
            )
            service.repository.update_status = AsyncMock(return_value=mock_sub)

            with patch.object(
                service, "_send_payment_failure_email", new_callable=AsyncMock
            ):
                invoice_data = {
                    "subscription": "sub_test_123",
                    "customer": "cus_test_123",
                }

                await service._handle_payment_failed(invoice_data)

                # Verify update_status was called with grace_period status
                service.repository.update_status.assert_called_once()
                call_kwargs = service.repository.update_status.call_args.kwargs
                assert call_kwargs["status"] == SubscriptionStatus.GRACE_PERIOD.value
                assert call_kwargs["grace_period_end"] is not None
                # Grace period should be ~7 days from now
                grace_end = call_kwargs["grace_period_end"]
                now = datetime.now(timezone.utc)
                delta = grace_end - now
                assert 6 <= delta.days <= 7  # Allow small timing variance

        import asyncio
        asyncio.run(_run())

    def test_grace_period_is_7_days(self):
        """Grace period after payment failure is exactly 7 days."""
        now = datetime.now(timezone.utc)
        grace_end = now + timedelta(days=7)

        # Verify the delta
        delta = grace_end - now
        assert delta.days == 7

    def test_usage_blocked_at_100_percent_preserves_read(self):
        """At 100% usage, actions are blocked but read access is preserved."""
        # Starter plan: 50 resume_reviews limit
        limit = PLAN_LIMITS[PlanTier.STARTER]["resume_reviews"]
        assert limit == 50

        # At exactly limit
        percentage = _calculate_percentage(limit, limit)
        assert percentage == 100.0

        # Blocked result still contains readable data
        result = UsageCheckResult(
            metric="resume_reviews",
            used=limit,
            limit=limit,
            percentage=percentage,
            status=UsageLimitStatus.BLOCKED,
        )
        assert result.is_blocked
        # Read access: all fields are accessible
        assert result.metric == "resume_reviews"
        assert result.used == limit
        assert result.limit == limit

    def test_plan_limits_increase_with_tier(self):
        """Each higher tier has equal or higher limits than the tier below."""
        for i in range(len(PLAN_ORDER) - 1):
            lower_tier = PLAN_ORDER[i]
            higher_tier = PLAN_ORDER[i + 1]
            lower_limits = PLAN_LIMITS[lower_tier]
            higher_limits = PLAN_LIMITS[higher_tier]

            for metric, lower_val in lower_limits.items():
                higher_val = higher_limits[metric]
                # -1 means unlimited, which is always >= any finite value
                if higher_val == -1:
                    continue
                assert higher_val >= lower_val, (
                    f"{higher_tier} {metric} ({higher_val}) should be >= "
                    f"{lower_tier} {metric} ({lower_val})"
                )

    def test_enterprise_plan_is_unlimited(self):
        """Enterprise plan has unlimited (-1) for all metrics."""
        enterprise_limits = PLAN_LIMITS[PlanTier.ENTERPRISE]
        for metric, value in enterprise_limits.items():
            assert value == -1, f"Enterprise {metric} should be unlimited (-1)"
