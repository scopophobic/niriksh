from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_officer
from app.db.models import User
from app.modules.prevention.service import case_verified_matches, get_pattern, list_patterns, review_pattern

router = APIRouter(prefix="/prevention", tags=["prevention intelligence"], dependencies=[Depends(require_officer)])

class ReviewRequest(BaseModel):
    status: str
    note: str | None = None

@router.get("/patterns")
def patterns(db: Session = Depends(get_db)) -> list[dict]: return list_patterns(db)

@router.get("/patterns/{pattern_id}")
def pattern(pattern_id: str, db: Session = Depends(get_db)) -> dict:
    try: return get_pattern(db, pattern_id)
    except LookupError: raise HTTPException(status_code=404, detail="Pattern not found") from None

@router.post("/patterns/{pattern_id}/review")
def review(pattern_id: str, payload: ReviewRequest, db: Session = Depends(get_db), user: User | None = Depends(require_officer)) -> dict:
    try: return review_pattern(db, pattern_id, payload.status, payload.note, user)
    except LookupError: raise HTTPException(status_code=404, detail="Pattern not found") from None
    except ValueError as error: raise HTTPException(status_code=422, detail=str(error)) from error

@router.get("/complaints/{complaint_id}/matches")
def matches(complaint_id: str, db: Session = Depends(get_db)) -> dict:
    return {"matches": case_verified_matches(db, complaint_id)}
