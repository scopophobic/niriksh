"""Add idempotent Bhumika supplements.

Revision ID: 20260905_0003
Revises: 20260904_0002
"""

from alembic import op
import sqlalchemy as sa

revision = "20260905_0003"
down_revision = "20260904_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "integration_supplements",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("integration_submission_id", sa.String(36), nullable=False),
        sa.Column("external_supplement_id", sa.String(250), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("request_payload", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["integration_submission_id"], ["integration_submissions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("integration_submission_id", "external_supplement_id", name="uq_integration_supplement"),
    )
    for column in ("integration_submission_id", "external_supplement_id", "status"):
        op.create_index(f"ix_integration_supplements_{column}", "integration_supplements", [column])


def downgrade() -> None:
    for column in ("status", "external_supplement_id", "integration_submission_id"):
        op.drop_index(f"ix_integration_supplements_{column}", table_name="integration_supplements")
    op.drop_table("integration_supplements")
