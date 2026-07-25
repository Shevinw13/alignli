"""Make assigned_manager_id nullable on hiring_projects.

Revision ID: 002
Revises: 001
Create Date: 2025-07-25
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop FK constraint first, then make nullable, then re-add FK
    op.drop_constraint(
        "hiring_projects_assigned_manager_id_fkey",
        "hiring_projects",
        type_="foreignkey",
    )
    op.alter_column(
        "hiring_projects",
        "assigned_manager_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=True,
    )
    op.create_foreign_key(
        "hiring_projects_assigned_manager_id_fkey",
        "hiring_projects",
        "users",
        ["assigned_manager_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "hiring_projects_assigned_manager_id_fkey",
        "hiring_projects",
        type_="foreignkey",
    )
    op.alter_column(
        "hiring_projects",
        "assigned_manager_id",
        existing_type=sa.dialects.postgresql.UUID(as_uuid=True),
        nullable=False,
    )
    op.create_foreign_key(
        "hiring_projects_assigned_manager_id_fkey",
        "hiring_projects",
        "users",
        ["assigned_manager_id"],
        ["id"],
    )
