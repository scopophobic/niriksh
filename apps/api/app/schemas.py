from typing import Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class ComplaintAnalysisRequest(BaseModel):
    description: str = Field(min_length=20, max_length=10_000)
    evidence_count: int = Field(default=0, ge=0, le=20)


class Entity(BaseModel):
    type: str
    value: str


class ComplaintAnalysis(BaseModel):
    summary: str
    primary_category: str
    secondary_categories: list[str]
    confidence: float = Field(ge=0, le=1)
    severity: Literal["critical", "high", "medium", "low", "needs_review"]
    severity_score: int = Field(ge=0, le=100)
    risk_factors: list[str]
    evidence_completeness: int = Field(ge=0, le=100)
    missing: list[str]
    entities: list[Entity]
    recommended_departments: list[str]
    ai_content_suspected: bool
    requires_human_review: bool = True


class DecisionRequest(BaseModel):
    action: Literal["approve", "override", "request_information"]
    category: str | None = None
    severity: str | None = None
    departments: list[str] = []
    reason: str | None = None
