import secrets
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import AnalysisRun, Complaint, EvidenceItem
from app.modules.analysis.engine import analysis_engine
from app.modules.audit.service import record_event
from app.modules.complaints.schemas import CasePayload, ComplaintCreate
from app.modules.connect.service import sync_case_indicators
from app.modules.review.policy import review_case


def new_reference(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    for _ in range(10):
        value = f"CYB-{year}-{secrets.randbelow(900_000) + 100_000}"
        if not db.scalar(select(Complaint.id).where(Complaint.reference == value)):
            return value
    raise RuntimeError("Could not allocate a unique complaint reference")


def build_case(db: Session, payload: ComplaintCreate) -> dict:
    finding = analysis_engine.analyze(payload.description, len(payload.evidence), payload.complaint_details).result
    now = datetime.now(timezone.utc)
    case_id = f"submitted-{secrets.token_hex(12)}"
    reference = new_reference(db)
    return review_case({
        "id": case_id,
        "reference": reference,
        "description": payload.description,
        "summary": finding["summary"],
        "reviewCategory": payload.complaint_details.get("selectedCategory", "other"),
        "category": finding["category"],
        "secondary": finding["secondary"],
        "severity": finding["severity"],
        "severityScore": finding["score"],
        "status": "Awaiting review",
        "completeness": finding["completeness"],
        "aiSuspected": finding["aiSuspected"],
        "createdAt": now.isoformat(),
        "createdLabel": "Just now",
        "platform": payload.complaint_details.get("channel"),
        "location": ", ".join(filter(None, [payload.complaint_details.get("district"), payload.complaint_details.get("state")])),
        "department": finding["departments"],
        "entities": finding["entities"],
        "evidence": [item.model_dump(exclude_none=True) for item in payload.evidence],
        "missing": finding["missing"],
        "riskFactors": finding["riskFactors"],
        "confidence": finding["confidence"],
        "analysisDetails": finding,
        "complaintDetails": payload.complaint_details,
        "citizenVerification": {
            "status": "Not reviewed",
            "summaryConfirmed": False,
            "confirmedEntities": 0,
            "totalEntities": len(finding["entities"]),
        },
        "audit": [
            {
                "label": "Complaint received",
                "detail": f"Complaint was received through {payload.source_channel}.",
                "time": "Just now",
                "actor": "Complainant",
            },
            {
                "label": "Initial analysis completed",
                "detail": "The policy analysis baseline prepared the complaint for human review.",
                "time": "Just now",
                "actor": "Niriksh Analysis",
            },
        ],
    })


def sync_case(db: Session, raw: dict, source_channel: str = "web", event_type: str = "complaint.created") -> Complaint:
    raw = review_case(raw)
    case = CasePayload.model_validate(raw)
    payload = case.model_dump(mode="json", exclude_none=True)
    complaint = db.get(Complaint, case.id)
    if complaint is None:
        complaint = Complaint(id=case.id, reference=case.reference, description=case.description)
        db.add(complaint)
    complaint.reference = case.reference
    complaint.source_channel = source_channel
    complaint.status = case.status
    complaint.description = case.description
    complaint.summary = case.summary
    complaint.category = case.category
    complaint.severity = case.severity
    complaint.severity_score = case.severityScore
    complaint.completeness = case.completeness
    complaint.confidence = case.confidence
    complaint.ai_suspected = case.aiSuspected
    complaint.platform = case.platform
    complaint.location = case.location
    complaint.case_payload = payload
    db.flush()

    db.execute(delete(EvidenceItem).where(EvidenceItem.complaint_id == complaint.id, EvidenceItem.storage_key.is_(None)))
    for item in case.evidence:
        metadata = item.model_dump(exclude_none=True)
        db.add(EvidenceItem(
            complaint_id=complaint.id,
            original_name=item.name,
            evidence_type=item.type,
            mime_type=item.mimeType or "application/octet-stream",
            display_size=item.size,
            sha256=item.sha256 if item.sha256 and len(item.sha256) == 64 else None,
            status="metadata_only",
            purpose=item.purpose,
            originality=item.originality,
            context_note=item.contextNote,
            extracted_text=item.extractedText,
            metadata_json=metadata,
        ))
    db.flush()
    sync_case_indicators(db, complaint)
    if case.analysisDetails:
        db.add(AnalysisRun(
            complaint_id=complaint.id,
            status="completed",
            provider=case.analysisDetails.get("engine", {}).get("label", "frontend-analysis"),
            input_version=complaint.version,
            result=case.analysisDetails,
            completed_at=datetime.now(timezone.utc),
        ))
    record_event(db, event_type, f"Complaint {case.reference} was persisted.", complaint.id, actor_type=source_channel)
    return complaint


def update_case(db: Session, complaint: Complaint, patch: dict, actor_type: str = "internal") -> Complaint:
    allowed = {"status", "summary", "reviewCategory", "category", "completeness", "department", "audit"}
    sanitized = {key: value for key, value in patch.items() if key in allowed and value is not None}
    payload = dict(complaint.case_payload or {})
    payload.update(sanitized)
    payload = review_case(payload)
    complaint.case_payload = payload
    complaint.version += 1
    for attr, key in [
        ("status", "status"), ("summary", "summary"), ("category", "category"),
        ("completeness", "completeness"),
    ]:
        if key in sanitized:
            setattr(complaint, attr, sanitized[key])
    complaint.category = payload["category"]
    complaint.severity = "Needs review"
    complaint.severity_score = 0
    complaint.confidence = 0
    record_event(db, "complaint.updated", f"Complaint {complaint.reference} was updated.", complaint.id, actor_type=actor_type, data={"fields": sorted(sanitized)})
    return complaint
