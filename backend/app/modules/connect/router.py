from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_officer
from app.modules.connect.service import find_related_incidents


router = APIRouter(
    prefix="/complaints/{complaint_id}/related-incidents",
    tags=["connect"],
    dependencies=[Depends(require_officer)],
)


@router.get("")
def related_incidents(complaint_id: str, db: Session = Depends(get_db)) -> dict:
    try:
        return find_related_incidents(db, complaint_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Complaint not found") from None
