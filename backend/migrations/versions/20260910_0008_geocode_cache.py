"""Add reverse-geocode cache for WhatsApp location shares.

Revision ID: 20260910_0008
Revises: 20260907_0007
"""

from alembic import op
import sqlalchemy as sa

revision = "20260910_0008"
down_revision = "20260907_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "geocode_cache",
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("state", sa.String(120), nullable=False),
        sa.Column("district", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("geocode_cache")
