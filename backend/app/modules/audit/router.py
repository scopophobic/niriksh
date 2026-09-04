from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_officer
from app.db.models import AuditEvent

router = APIRouter(prefix="/audit", tags=["audit"], dependencies=[Depends(require_officer)])


@router.get("/complaints/{complaint_id}")
def complaint_audit(complaint_id: str, db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(AuditEvent).where(AuditEvent.complaint_id == complaint_id).order_by(AuditEvent.created_at.asc())
    ).all()
    if not rows:
        raise HTTPException(status_code=404, detail="No audit history found")
    return [
        {
            "id": row.id,
            "event_type": row.event_type,
            "detail": row.detail,
            "actor_type": row.actor_type,
            "data": row.data,
            "created_at": row.created_at,
        }
        for row in rows
    ]

