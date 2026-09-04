import re
from pathlib import Path

import jwt
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_officer
from app.core.security import decode_access_token
from app.db.models import Complaint, EvidenceItem
from app.modules.audit.service import record_event

router = APIRouter(prefix="/complaints/{complaint_id}/evidence", tags=["evidence"], dependencies=[Depends(require_officer)])
intake_router = APIRouter(prefix="/complaints/{complaint_id}/intake-evidence", tags=["evidence"])


def safe_name(value: str) -> str:
    name = Path(value).name
    return re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip(".-")[:180] or "evidence.bin"


def serialize(item: EvidenceItem) -> dict:
    return {
        "id": item.id,
        "complaint_id": item.complaint_id,
        "name": item.original_name,
        "type": item.evidence_type,
        "mime_type": item.mime_type,
        "size_bytes": item.size_bytes,
        "sha256": item.sha256,
        "status": item.status,
        "purpose": item.purpose,
        "originality": item.originality,
        "context_note": item.context_note,
        "extracted_text": item.extracted_text,
        "analysis": (item.metadata_json or {}).get("analysis"),
        "created_at": item.created_at,
        "download_url": f"/api/v1/complaints/{item.complaint_id}/evidence/{item.id}/content" if item.storage_key else None,
    }


@router.get("")
def list_evidence(complaint_id: str, db: Session = Depends(get_db)) -> list[dict]:
    if not db.get(Complaint, complaint_id):
        raise HTTPException(status_code=404, detail="Complaint not found")
    rows = db.scalars(select(EvidenceItem).where(EvidenceItem.complaint_id == complaint_id).order_by(EvidenceItem.created_at)).all()
    return [serialize(item) for item in rows]


async def store_upload(
    complaint_id: str,
    request: Request,
    evidence: UploadFile,
    evidence_type: str,
    purpose: str | None,
    originality: str | None,
    context_note: str | None,
    expected_sha256: str | None,
    db: Session,
    actor_type: str = "internal",
) -> dict:
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    settings = request.app.state.settings
    expected_sha256 = expected_sha256.lower() if expected_sha256 and re.fullmatch(r"[a-fA-F0-9]{64}", expected_sha256) else None
    item = None
    if expected_sha256:
        item = db.scalar(select(EvidenceItem).where(
            EvidenceItem.complaint_id == complaint_id,
            EvidenceItem.sha256 == expected_sha256,
            EvidenceItem.status == "metadata_only",
        ).limit(1))
    if item is None:
        item = db.scalar(select(EvidenceItem).where(
            EvidenceItem.complaint_id == complaint_id,
            EvidenceItem.original_name == (evidence.filename or "evidence.bin"),
            EvidenceItem.status == "metadata_only",
        ).limit(1))
    if item is None:
        item = EvidenceItem(complaint_id=complaint_id, original_name=evidence.filename or "evidence.bin")
        db.add(item)
    item.evidence_type = evidence_type
    item.mime_type = evidence.content_type or "application/octet-stream"
    item.purpose = purpose
    item.originality = originality
    item.context_note = context_note
    item.status = "uploading"
    db.flush()
    storage = request.app.state.evidence_storage
    key = f"{complaint_id}/{item.id}-{safe_name(item.original_name)}"

    async def chunks():
        while chunk := await evidence.read(1024 * 1024):
            yield chunk

    try:
        stored = await storage.put_stream(key, chunks(), settings.max_evidence_bytes, expected_sha256)
    except ValueError as error:
        db.rollback()
        if str(error) == "too_large":
            raise HTTPException(status_code=413, detail="Evidence file exceeds the configured size limit") from None
        if str(error) == "digest_mismatch":
            raise HTTPException(status_code=422, detail="Uploaded bytes do not match the browser fingerprint") from None
        raise
    finally:
        await evidence.close()
    item.storage_key = stored.key
    item.size_bytes = stored.size
    item.sha256 = stored.sha256
    item.status = "stored"
    record_event(db, "evidence.stored", f"Evidence {item.original_name} was stored and hashed.", complaint_id, actor_type=actor_type, data={"evidence_id": item.id, "sha256": item.sha256})
    db.commit()
    return serialize(item)


@router.post("", status_code=201)
async def upload_evidence(
    complaint_id: str,
    request: Request,
    evidence: UploadFile = File(...),
    evidence_type: str = Form(default="Document"),
    purpose: str | None = Form(default=None),
    originality: str | None = Form(default=None),
    context_note: str | None = Form(default=None),
    expected_sha256: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> dict:
    return await store_upload(complaint_id, request, evidence, evidence_type, purpose, originality, context_note, expected_sha256, db)


@intake_router.post("", status_code=201)
async def upload_intake_evidence(
    complaint_id: str,
    request: Request,
    x_complaint_token: str = Header(default=""),
    evidence: UploadFile = File(...),
    evidence_type: str = Form(default="Document"),
    purpose: str | None = Form(default=None),
    originality: str | None = Form(default=None),
    context_note: str | None = Form(default=None),
    expected_sha256: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> dict:
    try:
        claims = decode_access_token(x_complaint_token, request.app.state.settings)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired complaint upload token") from None
    if claims.get("sub") != complaint_id or claims.get("role") != "citizen_upload":
        raise HTTPException(status_code=403, detail="Upload token does not grant access to this complaint")
    return await store_upload(complaint_id, request, evidence, evidence_type, purpose, originality, context_note, expected_sha256, db)


@router.get("/{evidence_id}/content")
def download_evidence(complaint_id: str, evidence_id: str, request: Request, db: Session = Depends(get_db)):
    item = db.get(EvidenceItem, evidence_id)
    if not item or item.complaint_id != complaint_id or not item.storage_key:
        raise HTTPException(status_code=404, detail="Evidence content not found")
    storage = request.app.state.evidence_storage
    path = storage.local_path(item.storage_key)
    if path is not None and path.is_file():
        return FileResponse(path, media_type=item.mime_type, filename=item.original_name)
    signed_url = storage.signed_download_url(item.storage_key, item.original_name, item.mime_type)
    if signed_url:
        return RedirectResponse(signed_url, status_code=307)
    if path is None or not path.is_file():
        raise HTTPException(status_code=410, detail="Evidence metadata exists but content is unavailable")
