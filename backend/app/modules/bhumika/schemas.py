from typing import Any, Literal

from pydantic import BaseModel, Field

from app.modules.complaints.schemas import EvidenceMetadata


class BhumikaReporter(BaseModel):
    external_id: str = Field(min_length=1, max_length=150)
    display_name: str | None = Field(default=None, max_length=200)
    preferred_language: str | None = Field(default=None, max_length=40)
    consent_to_process: bool = True


class BhumikaIntake(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    submission_id: str = Field(min_length=1, max_length=250)
    conversation_id: str = Field(min_length=1, max_length=250)
    reporter: BhumikaReporter
    description: str = Field(min_length=20, max_length=100_000)
    complaint_details: dict[str, Any] = Field(default_factory=dict)
    evidence: list[EvidenceMetadata] = Field(default_factory=list, max_length=20)
    finalize: bool = True
