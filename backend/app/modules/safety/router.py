from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_officer
from app.modules.review.policy import CATEGORIES
from app.modules.safety.schemas import IdentifierLookupRequest, IdentifierRecordRequest, MessageCheckRequest
from app.modules.safety.service import check_message, lookup_identifier, record_identifier

router = APIRouter(prefix="/safety", tags=["safety"])


@router.get("/categories")
def categories() -> dict:
    return {"categories": CATEGORIES, "policy": "A person selects and confirms the subject folder. Niriksh does not assign priority."}


@router.post("/check-message")
def message_check(payload: MessageCheckRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    settings = request.app.state.settings
    return check_message(db, payload.text, settings.directory_hash_secret or settings.jwt_secret)


@router.post("/lookup")
def identifier_lookup(payload: IdentifierLookupRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    settings = request.app.state.settings
    return lookup_identifier(db, payload.value, payload.type, settings.directory_hash_secret or settings.jwt_secret)


@router.post("/identifiers", status_code=201, dependencies=[Depends(require_officer)])
def identifier_record(payload: IdentifierRecordRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    settings = request.app.state.settings
    record = record_identifier(db, payload.value, payload.type, payload.status, payload.review_note, settings.directory_hash_secret or settings.jwt_secret)
    db.commit()
    return {
        "id": record.id,
        "type": record.identifier_type,
        "masked_value": record.masked_value,
        "status": record.status,
        "report_count": record.report_count,
    }
