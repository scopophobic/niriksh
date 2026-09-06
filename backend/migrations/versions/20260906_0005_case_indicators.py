"""Add explicit case indicators for deterministic correlation.

Revision ID: 20260906_0005
Revises: 20260906_0004
"""

from alembic import op
import sqlalchemy as sa

revision = "20260906_0005"
down_revision = "20260906_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "case_indicators",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("complaint_id", sa.String(64), nullable=False),
        sa.Column("indicator_type", sa.String(40), nullable=False),
        sa.Column("raw_value", sa.String(700), nullable=False),
        sa.Column("normalized_value", sa.String(500), nullable=False),
        sa.Column("source_evidence_id", sa.String(36), nullable=True),
        sa.Column("extraction_source", sa.String(40), nullable=False),
        sa.Column("source_label", sa.String(500), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["complaint_id"], ["complaints.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_evidence_id"], ["evidence_items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_case_indicators_complaint_id", "case_indicators", ["complaint_id"])
    op.create_index("ix_case_indicators_source_evidence_id", "case_indicators", ["source_evidence_id"])
    op.create_index("ix_case_indicators_match", "case_indicators", ["indicator_type", "normalized_value"])


def downgrade() -> None:
    op.drop_index("ix_case_indicators_match", table_name="case_indicators")
    op.drop_index("ix_case_indicators_source_evidence_id", table_name="case_indicators")
    op.drop_index("ix_case_indicators_complaint_id", table_name="case_indicators")
    op.drop_table("case_indicators")
