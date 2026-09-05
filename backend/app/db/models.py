import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def uid() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="triage")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Complaint(Base):
    __tablename__ = "complaints"
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=uid)
    reference: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    reporter_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    source_channel: Mapped[str] = mapped_column(String(32), default="web", index=True)
    status: Mapped[str] = mapped_column(String(40), default="Awaiting review", index=True)
    description: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(120), default="Needs review", index=True)
    severity: Mapped[str] = mapped_column(String(24), default="Needs review", index=True)
    severity_score: Mapped[int] = mapped_column(Integer, default=0)
    completeness: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    ai_suspected: Mapped[bool] = mapped_column(Boolean, default=False)
    platform: Mapped[str | None] = mapped_column(String(80), nullable=True)
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    case_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

    evidence: Mapped[list["EvidenceItem"]] = relationship(back_populates="complaint", cascade="all, delete-orphan")
    analyses: Mapped[list["AnalysisRun"]] = relationship(back_populates="complaint", cascade="all, delete-orphan")


class EvidenceItem(Base):
    __tablename__ = "evidence_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), index=True)
    original_name: Mapped[str] = mapped_column(String(500))
    evidence_type: Mapped[str] = mapped_column(String(30), default="Document")
    mime_type: Mapped[str] = mapped_column(String(200), default="application/octet-stream")
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    display_size: Mapped[str] = mapped_column(String(40), default="Unknown")
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    storage_key: Mapped[str | None] = mapped_column(String(700), nullable=True, unique=True)
    status: Mapped[str] = mapped_column(String(32), default="uploaded")
    purpose: Mapped[str | None] = mapped_column(String(80), nullable=True)
    originality: Mapped[str | None] = mapped_column(String(32), nullable=True)
    context_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    complaint: Mapped[Complaint] = relationship(back_populates="evidence")


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(24), default="queued", index=True)
    provider: Mapped[str] = mapped_column(String(80), default="local-policy-engine")
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    input_version: Mapped[int] = mapped_column(Integer, default=1)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    complaint: Mapped[Complaint] = relationship(back_populates="analyses")


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (UniqueConstraint("complaint_id", "version", name="uq_report_version"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    content_text: Mapped[str] = mapped_column(Text)
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RoutingDecision(Base):
    __tablename__ = "routing_decisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), index=True)
    action: Mapped[str] = mapped_column(String(40))
    recommendation: Mapped[dict] = mapped_column(JSON, default=dict)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SuspectIdentifier(Base):
    """Privacy-preserving aggregate; the original identifier is never stored."""

    __tablename__ = "suspect_identifiers"
    __table_args__ = (UniqueConstraint("identifier_type", "value_hash", name="uq_suspect_identifier_hash"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    identifier_type: Mapped[str] = mapped_column(String(32), index=True)
    value_hash: Mapped[str] = mapped_column(String(64), index=True)
    masked_value: Mapped[str] = mapped_column(String(320))
    status: Mapped[str] = mapped_column(String(32), default="reported", index=True)
    report_count: Mapped[int] = mapped_column(Integer, default=1)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    last_reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    complaint_id: Mapped[str | None] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), nullable=True, index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    actor_type: Mapped[str] = mapped_column(String(40), default="system")
    event_type: Mapped[str] = mapped_column(String(100), index=True)
    detail: Mapped[str] = mapped_column(Text)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class ChannelContact(Base):
    __tablename__ = "channel_contacts"
    __table_args__ = (UniqueConstraint("channel", "external_id", name="uq_channel_contact"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    channel: Mapped[str] = mapped_column(String(30), index=True)
    external_id: Mapped[str] = mapped_column(String(150), index=True)
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    locale: Mapped[str] = mapped_column(String(20), default="en")
    consent: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ChannelSession(Base):
    __tablename__ = "channel_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    contact_id: Mapped[str] = mapped_column(ForeignKey("channel_contacts.id", ondelete="CASCADE"), index=True)
    complaint_id: Mapped[str | None] = mapped_column(ForeignKey("complaints.id", ondelete="SET NULL"), nullable=True, index=True)
    state: Mapped[str] = mapped_column(String(50), default="collecting", index=True)
    context: Mapped[dict] = mapped_column(JSON, default=dict)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ChannelMessage(Base):
    __tablename__ = "channel_messages"
    __table_args__ = (UniqueConstraint("channel", "external_message_id", name="uq_channel_message"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    session_id: Mapped[str] = mapped_column(ForeignKey("channel_sessions.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(30))
    direction: Mapped[str] = mapped_column(String(8))
    external_message_id: Mapped[str | None] = mapped_column(String(250), nullable=True)
    message_type: Mapped[str] = mapped_column(String(30), default="text")
    text: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    provider: Mapped[str] = mapped_column(String(30), index=True)
    external_event_id: Mapped[str] = mapped_column(String(250))
    status: Mapped[str] = mapped_column(String(30), default="received", index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


Index("uq_webhook_provider_event", WebhookEvent.provider, WebhookEvent.external_event_id, unique=True)


class IntegrationSubmission(Base):
    __tablename__ = "integration_submissions"
    __table_args__ = (UniqueConstraint("source", "external_submission_id", name="uq_integration_submission"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    source: Mapped[str] = mapped_column(String(40), default="bhumika", index=True)
    external_submission_id: Mapped[str] = mapped_column(String(250), index=True)
    external_conversation_id: Mapped[str] = mapped_column(String(250), index=True)
    complaint_id: Mapped[str | None] = mapped_column(ForeignKey("complaints.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), default="received", index=True)
    request_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IntegrationSupplement(Base):
    __tablename__ = "integration_supplements"
    __table_args__ = (
        UniqueConstraint("integration_submission_id", "external_supplement_id", name="uq_integration_supplement"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    integration_submission_id: Mapped[str] = mapped_column(
        ForeignKey("integration_submissions.id", ondelete="CASCADE"), index=True
    )
    external_supplement_id: Mapped[str] = mapped_column(String(250), index=True)
    status: Mapped[str] = mapped_column(String(30), default="received", index=True)
    request_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
