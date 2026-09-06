import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import decode_tracking_token
from app.db.models import Complaint
from app.modules.tracking.service import public_tracking_payload


router = APIRouter(prefix="/public/tracking", tags=["public tracking"])


@router.get("/{token}")
def track_complaint(token: str, request: Request, db: Session = Depends(get_db)) -> dict:
    try:
        claims = decode_tracking_token(token, request.app.state.settings)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired tracking link") from None
    complaint = db.get(Complaint, claims.get("sub"))
    if not complaint or complaint.reference != claims.get("ref"):
        raise HTTPException(status_code=404, detail="Tracking record not found")
    return public_tracking_payload(db, complaint)
