"""Add the PSA officer-approval queue.

Revision ID: 20260907_0007
Revises: 20260907_0006
"""

from alembic import op
import sqlalchemy as sa

revision = "20260907_0007"
down_revision = "20260907_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "psa_queue_items",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("story_id", sa.String(200), nullable=False),
        sa.Column("story_title", sa.String(240), nullable=False),
        sa.Column("beats", sa.JSON(), nullable=False),
        sa.Column("video_url", sa.Text(), nullable=False),
        sa.Column("resolution", sa.String(16), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("cost_cents", sa.Integer(), nullable=False),
        sa.Column("used_reference_images", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source", sa.String(16), nullable=False, server_default="manual"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending_review"),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.String(36), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("publish_results", sa.JSON(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_psa_queue_items_status", "psa_queue_items", ["status"])
    op.create_index("ix_psa_queue_items_created_at", "psa_queue_items", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_psa_queue_items_created_at", table_name="psa_queue_items")
    op.drop_index("ix_psa_queue_items_status", table_name="psa_queue_items")
    op.drop_table("psa_queue_items")
