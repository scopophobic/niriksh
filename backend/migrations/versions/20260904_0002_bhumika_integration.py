"""Add idempotent Bhumika integration submissions.

Revision ID: 20260904_0002
Revises: 20260903_0001
"""

from alembic import op
import sqlalchemy as sa

revision = "20260904_0002"
down_revision = "20260903_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "integration_submissions",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("source", sa.String(40), nullable=False),
        sa.Column("external_submission_id", sa.String(250), nullable=False),
        sa.Column("external_conversation_id", sa.String(250), nullable=False),
        sa.Column("complaint_id", sa.String(64), nullable=True),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("request_payload", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["complaint_id"], ["complaints.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "external_submission_id", name="uq_integration_submission"),
    )
    for column in ("complaint_id", "external_conversation_id", "external_submission_id", "source", "status"):
        op.create_index(f"ix_integration_submissions_{column}", "integration_submissions", [column])


def downgrade() -> None:
    for column in ("status", "source", "external_submission_id", "external_conversation_id", "complaint_id"):
        op.drop_index(f"ix_integration_submissions_{column}", table_name="integration_submissions")
    op.drop_table("integration_submissions")
