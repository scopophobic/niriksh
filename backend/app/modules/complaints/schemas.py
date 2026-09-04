from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EvidenceMetadata(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    type: str = "Document"
    size: str = "Unknown"
    mimeType: str | None = None
    sha256: str | None = None
    contextNote: str | None = None
    extractedText: str | None = None
    purpose: str | None = None
    originality: str | None = None
    verified: bool | None = None
    previewUrl: str | None = None
    demo: bool | None = None


class ComplaintCreate(BaseModel):
    description: str = Field(min_length=20, max_length=100_000)
    complaint_details: dict[str, Any] = Field(default_factory=dict)
    evidence: list[EvidenceMetadata] = Field(default_factory=list, max_length=20)
    source_channel: str = Field(default="web", max_length=32)


class CasePayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=64)
    reference: str = Field(min_length=3, max_length=32)
    description: str = Field(min_length=1, max_length=100_000)
    summary: str = ""
    category: str = "Needs review"
    secondary: list[str] = Field(default_factory=list)
    severity: str = "Needs review"
    severityScore: int = Field(default=0, ge=0, le=100)
    status: str = "Awaiting review"
    completeness: int = Field(default=0, ge=0, le=100)
    aiSuspected: bool = False
    createdAt: str
    createdLabel: str = "Just now"
    platform: str | None = None
    location: str | None = None
    department: list[str] = Field(default_factory=list)
    entities: list[dict[str, Any]] = Field(default_factory=list)
    evidence: list[EvidenceMetadata] = Field(default_factory=list, max_length=20)
    missing: list[str] = Field(default_factory=list)
    riskFactors: list[str] = Field(default_factory=list)
    audit: list[dict[str, Any]] = Field(default_factory=list)
    confidence: float = Field(default=0, ge=0, le=1)
    analysisDetails: dict[str, Any] | None = None
    complaintDetails: dict[str, Any] | None = None
    citizenVerification: dict[str, Any] | None = None


class ComplaintPatch(BaseModel):
    model_config = ConfigDict(extra="allow")

    status: str | None = None
    summary: str | None = None
    category: str | None = None
    severity: str | None = None
    severityScore: int | None = Field(default=None, ge=0, le=100)
    completeness: int | None = Field(default=None, ge=0, le=100)
    department: list[str] | None = None
    audit: list[dict[str, Any]] | None = None

