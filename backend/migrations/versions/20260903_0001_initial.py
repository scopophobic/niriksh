"""Initial modular backend schema.

Revision ID: 20260903_0001
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "20260903_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "channel_contacts",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("channel", sa.String(30), nullable=False),
        sa.Column("external_id", sa.String(150), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=True),
        sa.Column("locale", sa.String(20), nullable=False),
        sa.Column("consent", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("channel", "external_id", name="uq_channel_contact"),
    )
    op.create_index("ix_channel_contacts_channel", "channel_contacts", ["channel"])
    op.create_index("ix_channel_contacts_external_id", "channel_contacts", ["external_id"])
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("phone", sa.String(32), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("phone"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table(
        "webhook_events",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("external_event_id", sa.String(250), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_webhook_events_next_attempt_at", "webhook_events", ["next_attempt_at"])
    op.create_index("ix_webhook_events_provider", "webhook_events", ["provider"])
    op.create_index("ix_webhook_events_status", "webhook_events", ["status"])
    op.create_index("uq_webhook_provider_event", "webhook_events", ["provider", "external_event_id"], unique=True)
    op.create_table(
        "complaints",
        sa.Column("id", sa.String(64), nullable=False),
        sa.Column("reference", sa.String(32), nullable=False),
        sa.Column("reporter_id", sa.String(36), nullable=True),
        sa.Column("source_channel", sa.String(32), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("category", sa.String(120), nullable=False),
        sa.Column("severity", sa.String(24), nullable=False),
        sa.Column("severity_score", sa.Integer(), nullable=False),
        sa.Column("completeness", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("ai_suspected", sa.Boolean(), nullable=False),
        sa.Column("platform", sa.String(80), nullable=True),
        sa.Column("location", sa.String(300), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("case_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("category", "created_at", "reporter_id", "severity", "source_channel", "status"):
        op.create_index(f"ix_complaints_{column}", "complaints", [column])
    op.create_index("ix_complaints_reference", "complaints", ["reference"], unique=True)
    op.create_table(
        "analysis_runs",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("complaint_id", sa.String(64), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("provider", sa.String(80), nullable=False),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("input_version", sa.Integer(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["complaint_id"], ["complaints.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analysis_runs_complaint_id", "analysis_runs", ["complaint_id"])
    op.create_index("ix_analysis_runs_status", "analysis_runs", ["status"])
    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("complaint_id", sa.String(64), nullable=True),
        sa.Column("actor_id", sa.String(36), nullable=True),
        sa.Column("actor_type", sa.String(40), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["complaint_id"], ["complaints.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("complaint_id", "created_at", "event_type"):
        op.create_index(f"ix_audit_events_{column}", "audit_events", [column])
    op.create_table(
        "channel_sessions",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("contact_id", sa.String(36), nullable=False),
        sa.Column("complaint_id", sa.String(64), nullable=True),
        sa.Column("state", sa.String(50), nullable=False),
        sa.Column("context", sa.JSON(), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["complaint_id"], ["complaints.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["contact_id"], ["channel_contacts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("complaint_id", "contact_id", "state"):
        op.create_index(f"ix_channel_sessions_{column}", "channel_sessions", [column])
    op.create_table(
        "evidence_items",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("complaint_id", sa.String(64), nullable=False),
        sa.Column("original_name", sa.String(500), nullable=False),
        sa.Column("evidence_type", sa.String(30), nullable=False),
        sa.Column("mime_type", sa.String(200), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("display_size", sa.String(40), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=True),
        sa.Column("storage_key", sa.String(700), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("purpose", sa.String(80), nullable=True),
        sa.Column("originality", sa.String(32), nullable=True),
        sa.Column("context_note", sa.Text(), nullable=True),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["complaint_id"], ["complaints.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    op.create_index("ix_evidence_items_complaint_id", "evidence_items", ["complaint_id"])
    op.create_index("ix_evidence_items_sha256", "evidence_items", ["sha256"])
    op.create_table(
        "reports",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("complaint_id", sa.String(64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["complaint_id"], ["complaints.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("complaint_id", "version", name="uq_report_version"),
    )
    op.create_index("ix_reports_complaint_id", "reports", ["complaint_id"])
    op.create_table(
        "routing_decisions",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("complaint_id", sa.String(64), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("recommendation", sa.JSON(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("actor_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["complaint_id"], ["complaints.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_routing_decisions_complaint_id", "routing_decisions", ["complaint_id"])
    op.create_table(
        "channel_messages",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("channel", sa.String(30), nullable=False),
        sa.Column("direction", sa.String(8), nullable=False),
        sa.Column("external_message_id", sa.String(250), nullable=True),
        sa.Column("message_type", sa.String(30), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["channel_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("channel", "external_message_id", name="uq_channel_message"),
    )
    op.create_index("ix_channel_messages_session_id", "channel_messages", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_channel_messages_session_id", table_name="channel_messages")
    op.drop_table("channel_messages")
    op.drop_index("ix_routing_decisions_complaint_id", table_name="routing_decisions")
    op.drop_table("routing_decisions")
    op.drop_index("ix_reports_complaint_id", table_name="reports")
    op.drop_table("reports")
    op.drop_index("ix_evidence_items_sha256", table_name="evidence_items")
    op.drop_index("ix_evidence_items_complaint_id", table_name="evidence_items")
    op.drop_table("evidence_items")
    for column in ("state", "contact_id", "complaint_id"):
        op.drop_index(f"ix_channel_sessions_{column}", table_name="channel_sessions")
    op.drop_table("channel_sessions")
    for column in ("event_type", "created_at", "complaint_id"):
        op.drop_index(f"ix_audit_events_{column}", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index("ix_analysis_runs_status", table_name="analysis_runs")
    op.drop_index("ix_analysis_runs_complaint_id", table_name="analysis_runs")
    op.drop_table("analysis_runs")
    for column in ("status", "source_channel", "severity", "reporter_id", "reference", "created_at", "category"):
        op.drop_index(f"ix_complaints_{column}", table_name="complaints")
    op.drop_table("complaints")
    op.drop_index("uq_webhook_provider_event", table_name="webhook_events")
    op.drop_index("ix_webhook_events_status", table_name="webhook_events")
    op.drop_index("ix_webhook_events_provider", table_name="webhook_events")
    op.drop_index("ix_webhook_events_next_attempt_at", table_name="webhook_events")
    op.drop_table("webhook_events")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    op.drop_index("ix_channel_contacts_external_id", table_name="channel_contacts")
    op.drop_index("ix_channel_contacts_channel", table_name="channel_contacts")
    op.drop_table("channel_contacts")
