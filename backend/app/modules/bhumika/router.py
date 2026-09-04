from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_bhumika_integration
from app.db.models import Complaint, EvidenceItem
from app.modules.bhumika.schemas import BhumikaIntake
from app.modules.bhumika.service import IdempotencyConflict, create_submission, finalize_submission, find_submission, response_for
from app.modules.evidence.router import serialize, store_upload

router = APIRouter(
    prefix="/integrations/bhumika",
    tags=["bhumika integration"],
    dependencies=[Depends(require_bhumika_integration)],
)


@router.post("/intakes", status_code=201)
def intake(payload: BhumikaIntake, request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    try:
        result, duplicate = create_submission(
            db,
            payload,
            request.app.state.complaint_analyzer,
            request.app.state.evidence_storage,
            request.app.state.settings.max_evidence_bytes,
        )
    except IdempotencyConflict as error:
        raise HTTPException(status_code=409, detail=str(error)) from None
    if duplicate:
        response.status_code = 200
    return result


@router.get("/intakes/{submission_id}")
def get_intake(submission_id: str, db: Session = Depends(get_db)) -> dict:
    submission = find_submission(db, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    return response_for(db, submission)


@router.post("/intakes/{submission_id}/evidence", status_code=201)
async def upload_intake_evidence(
    submission_id: str,
    request: Request,
    response: Response,
    external_evidence_id: str = Form(..., min_length=1, max_length=250),
    evidence: UploadFile = File(...),
    evidence_type: str = Form(default="Document"),
    purpose: str | None = Form(default=None),
    originality: str | None = Form(default=None),
    context_note: str | None = Form(default=None),
    expected_sha256: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> dict:
    submission = find_submission(db, submission_id)
    if not submission or not submission.complaint_id:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.status == "completed":
        raise HTTPException(status_code=409, detail="Submission is already finalized")
    items = db.scalars(select(EvidenceItem).where(EvidenceItem.complaint_id == submission.complaint_id)).all()
    duplicate = next((item for item in items if (item.metadata_json or {}).get("bhumika_external_evidence_id") == external_evidence_id), None)
    if duplicate:
        response.status_code = 200
        return {"accepted": True, "duplicate": True, "evidence": serialize(duplicate)}

    stored = await store_upload(
        submission.complaint_id,
        request,
        evidence,
        evidence_type,
        purpose,
        originality,
        context_note,
        expected_sha256,
        db,
        actor_type="bhumika",
    )
    item = db.get(EvidenceItem, stored["id"])
    if item:
        item.metadata_json = {**(item.metadata_json or {}), "bhumika_external_evidence_id": external_evidence_id}
    submission.status = "evidence_pending"
    complaint = db.get(Complaint, submission.complaint_id)
    if complaint:
        complaint.status = "Evidence pending"
        complaint.case_payload = {**(complaint.case_payload or {}), "status": "Evidence pending"}
    db.commit()
    return {"accepted": True, "duplicate": False, "evidence": serialize(item) if item else stored}


@router.post("/intakes/{submission_id}/finalize")
def finalize_intake(submission_id: str, request: Request, db: Session = Depends(get_db)) -> dict:
    submission = find_submission(db, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    try:
        return finalize_submission(
            db,
            submission,
            request.app.state.complaint_analyzer,
            request.app.state.evidence_storage,
            request.app.state.settings.max_evidence_bytes,
        )
    except LookupError as error:
        raise HTTPException(status_code=409, detail=str(error)) from None
