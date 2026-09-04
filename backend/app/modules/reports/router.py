from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_officer
from app.db.models import Complaint, Report, User
from app.modules.audit.service import record_event
from app.modules.reports.service import create_report_snapshot

router = APIRouter(prefix="/complaints/{complaint_id}/reports", tags=["reports"], dependencies=[Depends(require_officer)])


@router.post("", status_code=201)
def create_report(complaint_id: str, db: Session = Depends(get_db), actor: User | None = Depends(require_officer)) -> dict:
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    report = create_report_snapshot(db, complaint, actor.id if actor else None)
    record_event(db, "report.created", f"Report version {report.version} was generated.", complaint_id, actor=actor)
    db.commit()
    return {"id": report.id, "version": report.version, "content_text": report.content_text, "created_at": report.created_at}


@router.get("")
def list_reports(complaint_id: str, db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(Report).where(Report.complaint_id == complaint_id).order_by(Report.version.desc())).all()
    return [{"id": row.id, "version": row.version, "content_text": row.content_text, "created_at": row.created_at} for row in rows]
