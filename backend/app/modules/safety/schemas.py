from typing import Literal

from pydantic import BaseModel, Field

IdentifierType = Literal["phone", "email", "upi", "url", "social_handle", "sms_header", "other"]


class MessageCheckRequest(BaseModel):
    text: str = Field(min_length=3, max_length=20_000)


class IdentifierLookupRequest(BaseModel):
    value: str = Field(min_length=3, max_length=500)
    type: IdentifierType | None = None


class IdentifierRecordRequest(IdentifierLookupRequest):
    status: Literal["reported", "reviewed_concern", "cleared"] = "reported"
    review_note: str | None = Field(default=None, max_length=1000)
