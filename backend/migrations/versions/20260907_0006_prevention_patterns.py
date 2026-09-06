"""Add reviewable prevention-intelligence patterns.

Revision ID: 20260907_0006
Revises: 20260906_0005
"""

from alembic import op
import sqlalchemy as sa

revision = "20260907_0006"
down_revision = "20260906_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "prevention_patterns",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("cluster_key", sa.String(128), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("behavioural_pattern", sa.Text(), nullable=True),
        sa.Column("shared_indicators", sa.JSON(), nullable=False),
        sa.Column("supporting_complaints", sa.JSON(), nullable=False),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.String(36), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_prevention_patterns_cluster_key", "prevention_patterns", ["cluster_key"], unique=True)
    op.create_index("ix_prevention_patterns_status", "prevention_patterns", ["status"])
    op.create_table(
        "prevention_pattern_reviews",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("pattern_id", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("reviewer_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["pattern_id"], ["prevention_patterns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_prevention_pattern_reviews_pattern_id", "prevention_pattern_reviews", ["pattern_id"])


def downgrade() -> None:
    op.drop_index("ix_prevention_pattern_reviews_pattern_id", table_name="prevention_pattern_reviews")
    op.drop_table("prevention_pattern_reviews")
    op.drop_index("ix_prevention_patterns_status", table_name="prevention_patterns")
    op.drop_index("ix_prevention_patterns_cluster_key", table_name="prevention_patterns")
    op.drop_table("prevention_patterns")
