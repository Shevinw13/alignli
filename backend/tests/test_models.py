"""Tests for SQLAlchemy ORM models and database schema."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.core.database.base import Base, SoftDeleteMixin, TimestampMixin
from app.models import (
    AIResponse,
    AuditLog,
    Candidate,
    CandidateCommunication,
    CandidateDocument,
    CandidateScore,
    HiringProject,
    InterviewNote,
    Notification,
    Organization,
    RankingCriteria,
    Subscription,
    User,
)


class TestAllModelsRegistered:
    """Verify all 13 tables are registered in metadata."""

    def test_table_count(self) -> None:
        assert len(Base.metadata.tables) == 13

    def test_expected_tables_present(self) -> None:
        expected = {
            "organizations",
            "users",
            "hiring_projects",
            "ranking_criteria",
            "candidates",
            "candidate_scores",
            "candidate_documents",
            "candidate_communications",
            "interview_notes",
            "ai_responses",
            "subscriptions",
            "audit_logs",
            "notifications",
        }
        assert set(Base.metadata.tables.keys()) == expected


class TestSoftDeleteMixin:
    """Verify SoftDeleteMixin behavior."""

    def test_soft_delete_marks_deleted_at(self) -> None:
        mixin = SoftDeleteMixin()
        mixin.deleted_at = None
        assert mixin.is_deleted is False
        mixin.soft_delete()
        assert mixin.is_deleted is True
        assert mixin.deleted_at is not None

    def test_restore_clears_deleted_at(self) -> None:
        mixin = SoftDeleteMixin()
        mixin.deleted_at = datetime.now(timezone.utc)
        assert mixin.is_deleted is True
        mixin.restore()
        assert mixin.is_deleted is False
        assert mixin.deleted_at is None

    def test_models_with_soft_delete(self) -> None:
        """All primary entities use SoftDeleteMixin."""
        soft_delete_models = [
            Organization, User, HiringProject, RankingCriteria,
            Candidate, InterviewNote,
        ]
        for model in soft_delete_models:
            assert issubclass(model, SoftDeleteMixin), f"{model.__name__} missing SoftDeleteMixin"

    def test_candidate_document_has_deleted_at(self) -> None:
        """CandidateDocument has deleted_at but uses custom implementation."""
        assert hasattr(CandidateDocument, "deleted_at")
        assert hasattr(CandidateDocument, "is_deleted")


class TestTimestampMixin:
    """Verify TimestampMixin is applied correctly."""

    def test_models_with_timestamps(self) -> None:
        timestamp_models = [
            Organization, User, HiringProject, RankingCriteria,
            Candidate, CandidateScore, Subscription,
        ]
        for model in timestamp_models:
            assert issubclass(model, TimestampMixin), f"{model.__name__} missing TimestampMixin"


class TestIndexes:
    """Verify custom indexes are defined in model metadata."""

    def test_hiring_projects_org_state_index(self) -> None:
        table = Base.metadata.tables["hiring_projects"]
        index_names = [idx.name for idx in table.indexes]
        assert "idx_hiring_projects_org_state" in index_names

    def test_candidates_project_score_index(self) -> None:
        table = Base.metadata.tables["candidates"]
        index_names = [idx.name for idx in table.indexes]
        assert "idx_candidates_project_score" in index_names

    def test_audit_logs_org_created_index(self) -> None:
        table = Base.metadata.tables["audit_logs"]
        index_names = [idx.name for idx in table.indexes]
        assert "idx_audit_logs_org_created" in index_names


class TestCheckConstraints:
    """Verify check constraints are defined."""

    def test_max_score_constraint(self) -> None:
        table = Base.metadata.tables["ranking_criteria"]
        constraint_names = [c.name for c in table.constraints if hasattr(c, "name")]
        assert "ck_max_score_range" in constraint_names

    def test_match_score_constraint(self) -> None:
        table = Base.metadata.tables["candidates"]
        constraint_names = [c.name for c in table.constraints if hasattr(c, "name")]
        assert "ck_match_score_range" in constraint_names

    def test_raw_score_constraint(self) -> None:
        table = Base.metadata.tables["candidate_scores"]
        constraint_names = [c.name for c in table.constraints if hasattr(c, "name")]
        assert "ck_raw_score_range" in constraint_names

    def test_content_length_constraint(self) -> None:
        table = Base.metadata.tables["interview_notes"]
        constraint_names = [c.name for c in table.constraints if hasattr(c, "name")]
        assert "ck_content_length" in constraint_names


class TestUniqueConstraints:
    """Verify unique constraints."""

    def test_candidate_criteria_unique(self) -> None:
        table = Base.metadata.tables["candidate_scores"]
        constraint_names = [c.name for c in table.constraints if hasattr(c, "name") and c.name]
        assert "uq_candidate_criteria" in constraint_names

    def test_clerk_org_id_unique(self) -> None:
        table = Base.metadata.tables["organizations"]
        columns = table.columns
        assert columns["clerk_org_id"].unique is True

    def test_clerk_user_id_unique(self) -> None:
        table = Base.metadata.tables["users"]
        columns = table.columns
        assert columns["clerk_user_id"].unique is True

    def test_subscription_org_unique(self) -> None:
        table = Base.metadata.tables["subscriptions"]
        columns = table.columns
        assert columns["organization_id"].unique is True


class TestForeignKeys:
    """Verify foreign key relationships are defined correctly."""

    def test_users_org_fk(self) -> None:
        table = Base.metadata.tables["users"]
        fk_targets = {
            str(fk.target_fullname) for fk in table.foreign_keys
        }
        assert "organizations.id" in fk_targets

    def test_hiring_projects_fks(self) -> None:
        table = Base.metadata.tables["hiring_projects"]
        fk_targets = {
            str(fk.target_fullname) for fk in table.foreign_keys
        }
        assert "organizations.id" in fk_targets
        assert "users.id" in fk_targets

    def test_candidates_fks(self) -> None:
        table = Base.metadata.tables["candidates"]
        fk_targets = {
            str(fk.target_fullname) for fk in table.foreign_keys
        }
        assert "hiring_projects.id" in fk_targets
        assert "organizations.id" in fk_targets

    def test_candidate_scores_fks(self) -> None:
        table = Base.metadata.tables["candidate_scores"]
        fk_targets = {
            str(fk.target_fullname) for fk in table.foreign_keys
        }
        assert "candidates.id" in fk_targets
        assert "ranking_criteria.id" in fk_targets


class TestMigrationIntegrity:
    """Verify migration file references correct tables."""

    def test_migration_file_importable(self) -> None:
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "migration", "alembic/versions/001_initial_schema.py"
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        assert mod.revision == "001"
        assert mod.down_revision is None
        assert callable(mod.upgrade)
        assert callable(mod.downgrade)
