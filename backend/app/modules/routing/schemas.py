from typing import Literal

from pydantic import BaseModel, Field, model_validator


class RoutingDecisionRequest(BaseModel):
    action: Literal["approve", "override", "request_information"]
    category: str | None = None
    departments: list[str] = Field(default_factory=list)
    reason: str | None = None

    @model_validator(mode="after")
    def override_needs_reason(self):
        if self.action in {"approve", "override"} and not (self.reason or "").strip():
            raise ValueError("A human routing reason is required")
        return self
