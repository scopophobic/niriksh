from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_officer
from app.core.security import create_access_token
from app.db.models import Complaint
from app.modules.complaints.schemas import CasePayload, ComplaintCreate, ComplaintPatch
from app.modules.complaints.service import build_case, new_reference, sync_case, update_case

router = APIRouter(prefix="/complaints", tags=["complaints"])


@router.post("", status_code=201)
def create_complaint(payload: ComplaintCreate, db: Session = Depends(get_db)) -> dict:
    case = build_case(db, payload)
    sync_case(db, case, "web")
    db.commit()
    return case


@router.post("/import", status_code=201, dependencies=[Depends(require_officer)])
def import_case(payload: CasePayload, db: Session = Depends(get_db)) -> dict:
    existing = db.get(Complaint, payload.id)
    raw = payload.model_dump(mode="json", exclude_none=True)
    if not existing:
        raw["reference"] = new_reference(db)
    complaint = sync_case(db, raw, event_type="complaint.synced" if existing else "complaint.created")
    db.commit()
    return complaint.case_payload


@router.post("/intake", status_code=201)
def intake_existing_case(payload: CasePayload, request: Request, db: Session = Depends(get_db)) -> dict:
    """Compatibility endpoint for the public guided form; never updates an existing case."""
    existing = db.get(Complaint, payload.id)
    if existing:
        stored = existing.case_payload or {}
        same_submission = all(stored.get(key) == getattr(payload, key) for key in ("description", "summary", "createdAt"))
        if not same_submission:
            raise HTTPException(status_code=409, detail="Complaint already exists")
        return {
            **stored,
            "_uploadToken": create_access_token(existing.id, "citizen_upload", request.app.state.settings),
        }
    raw = payload.model_dump(mode="json", exclude_none=True)
    raw["reference"] = new_reference(db)
    complaint = sync_case(db, raw, source_channel="web", event_type="complaint.created")
    db.commit()
    return {
        **complaint.case_payload,
        "_uploadToken": create_access_token(complaint.id, "citizen_upload", request.app.state.settings),
    }


@router.get("", dependencies=[Depends(require_officer)])
def list_complaints(
    status: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = select(Complaint).order_by(Complaint.created_at.desc()).limit(limit)
    if status:
        query = query.where(Complaint.status == status)
    return [row.case_payload for row in db.scalars(query).all()]


@router.get("/{complaint_id}", dependencies=[Depends(require_officer)])
def get_complaint(complaint_id: str, db: Session = Depends(get_db)) -> dict:
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint.case_payload


@router.patch("/{complaint_id}", dependencies=[Depends(require_officer)])
def patch_complaint(
    complaint_id: str,
    payload: ComplaintPatch,
    if_match: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if if_match is not None and if_match.strip('"') != str(complaint.version):
        raise HTTPException(status_code=409, detail="Complaint was changed by another user")
    update_case(db, complaint, payload.model_dump(exclude_none=True))
    db.commit()
    return complaint.case_payload
