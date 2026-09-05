"""Add privacy-preserving suspect identifier directory.

Revision ID: 20260906_0004
Revises: 20260905_0003
"""

from alembic import op
import sqlalchemy as sa

revision = "20260906_0004"
down_revision = "20260905_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "suspect_identifiers",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("identifier_type", sa.String(32), nullable=False),
        sa.Column("value_hash", sa.String(64), nullable=False),
        sa.Column("masked_value", sa.String(320), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("report_count", sa.Integer(), nullable=False),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("first_reported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_reported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("identifier_type", "value_hash", name="uq_suspect_identifier_hash"),
    )
    for column in ("identifier_type", "value_hash", "status"):
        op.create_index(f"ix_suspect_identifiers_{column}", "suspect_identifiers", [column])


def downgrade() -> None:
    for column in ("status", "value_hash", "identifier_type"):
        op.drop_index(f"ix_suspect_identifiers_{column}", table_name="suspect_identifiers")
    op.drop_table("suspect_identifiers")
