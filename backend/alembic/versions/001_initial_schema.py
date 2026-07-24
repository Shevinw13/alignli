"""Initial schema with all core tables, indexes, and RLS policies.

Revision ID: 001
Revises: None
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- organizations ---
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("clerk_org_id", sa.String(255), nullable=False),
        sa.Column("plan_id", sa.String(50), server_default=sa.text("'free'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clerk_org_id"),
    )

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clerk_user_id", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clerk_user_id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
    )

    # --- hiring_projects ---
    op.create_table(
        "hiring_projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("location", sa.String(100), nullable=False),
        sa.Column("employment_type", sa.String(20), nullable=False),
        sa.Column("remote_preference", sa.String(20), nullable=False),
        sa.Column("assigned_manager_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_description_raw", sa.Text(), nullable=True),
        sa.Column("job_description_extracted", postgresql.JSONB(), nullable=True),
        sa.Column("state", sa.String(30), server_default=sa.text("'draft'"), nullable=False),
        sa.Column("state_history", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("filled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["assigned_manager_id"], ["users.id"]),
    )

    # --- ranking_criteria ---
    op.create_table(
        "ranking_criteria",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hiring_project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("priority", sa.String(10), nullable=False),
        sa.Column("max_score", sa.Integer(), nullable=False),
        sa.Column("weight", sa.Numeric(5, 4), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["hiring_project_id"], ["hiring_projects.id"]),
        sa.CheckConstraint("max_score >= 1 AND max_score <= 100", name="ck_max_score_range"),
    )

    # --- candidates ---
    op.create_table(
        "candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("hiring_project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("github_url", sa.String(500), nullable=True),
        sa.Column("portfolio_url", sa.String(500), nullable=True),
        sa.Column("website_url", sa.String(500), nullable=True),
        sa.Column("current_company", sa.String(255), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("years_experience", sa.Integer(), nullable=True),
        sa.Column("match_score", sa.Integer(), nullable=True),
        sa.Column("confidence_level", sa.String(10), nullable=True),
        sa.Column("processing_status", sa.String(30), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("status", sa.String(30), server_default=sa.text("'active'"), nullable=False),
        sa.Column("parsed_data", postgresql.JSONB(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("strengths", postgresql.JSONB(), nullable=True),
        sa.Column("concerns", postgresql.JSONB(), nullable=True),
        sa.Column("interview_questions", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["hiring_project_id"], ["hiring_projects.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.CheckConstraint("match_score IS NULL OR (match_score >= 0 AND match_score <= 100)", name="ck_match_score_range"),
    )

    # --- candidate_scores ---
    op.create_table(
        "candidate_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ranking_criteria_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("raw_score", sa.Integer(), nullable=False),
        sa.Column("normalized_score", sa.Numeric(7, 4), nullable=False),
        sa.Column("weighted_score", sa.Numeric(7, 4), nullable=False),
        sa.Column("reasoning", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["ranking_criteria_id"], ["ranking_criteria.id"]),
        sa.UniqueConstraint("candidate_id", "ranking_criteria_id", name="uq_candidate_criteria"),
        sa.CheckConstraint("raw_score >= 0 AND raw_score <= 100", name="ck_raw_score_range"),
    )

    # --- candidate_documents ---
    op.create_table(
        "candidate_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("virus_scan_status", sa.String(20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
    )

    # --- candidate_communications ---
    op.create_table(
        "candidate_communications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hiring_project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("delivery_status", sa.String(30), server_default=sa.text("'pending'"), nullable=False),
        sa.Column("resend_message_id", sa.String(255), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["hiring_project_id"], ["hiring_projects.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
    )

    # --- interview_notes ---
    op.create_table(
        "interview_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.CheckConstraint("length(content) <= 5000", name="ck_content_length"),
    )

    # --- ai_responses ---
    op.create_table(
        "ai_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("hiring_project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("prompt_type", sa.String(50), nullable=False),
        sa.Column("prompt_version", sa.String(20), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.String(10), nullable=True),
        sa.Column("response_content", postgresql.JSONB(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["hiring_project_id"], ["hiring_projects.id"]),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
    )

    # --- subscriptions ---
    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stripe_customer_id", sa.String(255), nullable=False),
        sa.Column("stripe_subscription_id", sa.String(255), nullable=True),
        sa.Column("plan_id", sa.String(50), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("grace_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.UniqueConstraint("organization_id"),
    )

    # --- audit_logs ---
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
    )

    # --- notifications ---
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )

    # --- Custom Indexes ---
    op.create_index(
        "idx_hiring_projects_org_state",
        "hiring_projects",
        ["organization_id", "state", "deleted_at"],
    )
    op.create_index(
        "idx_candidates_project_score",
        "candidates",
        ["hiring_project_id", sa.text("match_score DESC"), "deleted_at"],
    )
    op.create_index(
        "idx_audit_logs_org_created",
        "audit_logs",
        ["organization_id", sa.text("created_at DESC")],
    )

    # --- Row-Level Security Policies ---
    # Enable RLS on all tables with organization_id
    tables_with_org_id = [
        "users",
        "hiring_projects",
        "candidates",
        "candidate_documents",
        "candidate_communications",
        "ai_responses",
        "subscriptions",
        "audit_logs",
        "notifications",
    ]

    for table in tables_with_org_id:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_org_isolation ON {table} "
            f"USING (organization_id = current_setting('app.current_org_id')::uuid)"
        )

    # ranking_criteria doesn't have organization_id directly but is scoped through hiring_project
    op.execute("ALTER TABLE ranking_criteria ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE ranking_criteria FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY ranking_criteria_org_isolation ON ranking_criteria "
        "USING (hiring_project_id IN ("
        "  SELECT id FROM hiring_projects "
        "  WHERE organization_id = current_setting('app.current_org_id')::uuid"
        "))"
    )

    # candidate_scores scoped through candidate
    op.execute("ALTER TABLE candidate_scores ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE candidate_scores FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY candidate_scores_org_isolation ON candidate_scores "
        "USING (candidate_id IN ("
        "  SELECT id FROM candidates "
        "  WHERE organization_id = current_setting('app.current_org_id')::uuid"
        "))"
    )

    # interview_notes scoped through candidate
    op.execute("ALTER TABLE interview_notes ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE interview_notes FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY interview_notes_org_isolation ON interview_notes "
        "USING (candidate_id IN ("
        "  SELECT id FROM candidates "
        "  WHERE organization_id = current_setting('app.current_org_id')::uuid"
        "))"
    )


def downgrade() -> None:
    # Drop RLS policies
    all_tables = [
        "users", "hiring_projects", "candidates", "candidate_documents",
        "candidate_communications", "ai_responses", "subscriptions",
        "audit_logs", "notifications", "ranking_criteria",
        "candidate_scores", "interview_notes",
    ]
    for table in all_tables:
        op.execute(f"DROP POLICY IF EXISTS {table}_org_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # Drop indexes
    op.drop_index("idx_audit_logs_org_created", table_name="audit_logs")
    op.drop_index("idx_candidates_project_score", table_name="candidates")
    op.drop_index("idx_hiring_projects_org_state", table_name="hiring_projects")

    # Drop tables in reverse dependency order
    op.drop_table("notifications")
    op.drop_table("audit_logs")
    op.drop_table("subscriptions")
    op.drop_table("ai_responses")
    op.drop_table("interview_notes")
    op.drop_table("candidate_communications")
    op.drop_table("candidate_documents")
    op.drop_table("candidate_scores")
    op.drop_table("candidates")
    op.drop_table("ranking_criteria")
    op.drop_table("hiring_projects")
    op.drop_table("users")
    op.drop_table("organizations")
