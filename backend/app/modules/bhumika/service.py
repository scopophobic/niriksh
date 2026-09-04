from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AnalysisRun, Complaint, EvidenceItem, IntegrationSubmission, Report
from app.modules.analysis.provider import GeminiComplaintAnalyzer, MediaInput
from app.modules.analysis.service import apply_baseline_finding, apply_connected_finding, persist_case
from app.modules.audit.service import record_event
from app.modules.bhumika.schemas import BhumikaIntake
from app.modules.complaints.schemas import ComplaintCreate
from app.modules.complaints.service import build_case, sync_case
from app.modules.reports.service import create_report_snapshot
from app.storage import EvidenceStorage


class IdempotencyConflict(ValueError):
    pass


def find_submission(db: Session, submission_id: str) -> IntegrationSubmission | None:
    return db.scalar(select(IntegrationSubmission).where(
        IntegrationSubmission.source == "bhumika",
        IntegrationSubmission.external_submission_id == submission_id,
    ))


def response_for(db: Session, submission: IntegrationSubmission, duplicate: bool = False) -> dict:
    complaint = db.get(Complaint, submission.complaint_id) if submission.complaint_id else None
    case = complaint.case_payload if complaint else {}
    report = db.scalar(select(Report).where(Report.complaint_id == complaint.id).order_by(Report.version.desc())) if complaint else None
    analysis = case.get("analysisDetails") or {}
    engine = analysis.get("engine") or {}
    return {
        "accepted": True,
        "duplicate": duplicate,
        "submission_id": submission.external_submission_id,
        "conversation_id": submission.external_conversation_id,
        "processing_status": submission.status,
        "complaint_id": complaint.id if complaint else None,
        "tracking_number": complaint.reference if complaint else None,
        "case_status": complaint.status if complaint else None,
        "analysis": {
            "mode": engine.get("mode", "Deterministic baseline"),
            "provider": engine.get("label", "local-policy-engine"),
            "model": engine.get("model"),
            "category": complaint.category if complaint else None,
            "severity": complaint.severity if complaint else None,
            "completeness": complaint.completeness if complaint else None,
            "missing_questions": case.get("missing", []),
        },
        "report": ({
            "id": report.id,
            "version": report.version,
            "content_text": report.content_text,
            "created_at": report.created_at,
        } if report else None),
        "evidence_upload_path": f"/api/v1/integrations/bhumika/intakes/{submission.external_submission_id}/evidence",
        "finalize_path": f"/api/v1/integrations/bhumika/intakes/{submission.external_submission_id}/finalize",
    }


def finalize_submission(
    db: Session,
    submission: IntegrationSubmission,
    analyzer: GeminiComplaintAnalyzer,
    storage: EvidenceStorage,
    maximum: int,
) -> dict:
    if submission.status == "completed":
        return response_for(db, submission, duplicate=True)
    complaint = db.get(Complaint, submission.complaint_id) if submission.complaint_id else None
    if complaint is None:
        raise LookupError("Submission does not point to a complaint")

    case = dict(complaint.case_payload or {})
    apply_baseline_finding(case)
    media: list[MediaInput] = []
    transcript_context: list[str] = []
    for item in db.scalars(select(EvidenceItem).where(EvidenceItem.complaint_id == complaint.id).order_by(EvidenceItem.created_at)).all():
        if item.extracted_text:
            transcript_context.append(f"{item.original_name}: {item.extracted_text}")
        if not item.storage_key:
            continue
        try:
            content = storage.get_bytes(item.storage_key, maximum)
        except Exception as error:
            record_event(
                db,
                "evidence.read_failed",
                f"Evidence {item.original_name} could not be read for analysis.",
                complaint.id,
                actor_type="analysis",
                data={"evidence_id": item.id, "error_type": type(error).__name__},
            )
            continue
        media.append(MediaInput(item.id, item.original_name, item.mime_type, content))

    narrative = case["description"]
    if transcript_context:
        narrative += "\n\nBhumika-provided evidence transcripts/context:\n" + "\n".join(transcript_context)
    connected_used = False
    if analyzer.configured:
        try:
            connected = analyzer.analyze(narrative, case.get("complaintDetails", {}), media)
            if connected:
                apply_connected_finding(db, complaint, case, connected)
                connected_used = True
                record_event(db, "analysis.completed", "Connected analysis completed for a Bhumika submission.", complaint.id, actor_type="analysis", data={"model": connected.model})
        except RuntimeError as error:
            db.add(AnalysisRun(
                complaint_id=complaint.id,
                status="failed",
                provider="Gemini",
                input_version=complaint.version,
                error=str(error),
                completed_at=datetime.now(timezone.utc),
            ))
            record_event(db, "analysis.fallback", "Connected analysis was unavailable; deterministic triage was retained.", complaint.id, actor_type="analysis")

    case["status"] = "Awaiting review"
    complaint.status = "Awaiting review"
    persist_case(complaint, case)
    report = create_report_snapshot(db, complaint)
    submission.status = "completed"
    submission.processed_at = datetime.now(timezone.utc)
    submission.error = None
    record_event(
        db,
        "bhumika.submission_completed",
        f"Bhumika submission produced report version {report.version}.",
        complaint.id,
        actor_type="bhumika",
        data={"submission_id": submission.external_submission_id, "connected_analysis": connected_used},
    )
    db.commit()
    return response_for(db, submission)


def create_submission(
    db: Session,
    payload: BhumikaIntake,
    analyzer: GeminiComplaintAnalyzer,
    storage: EvidenceStorage,
    maximum: int,
) -> tuple[dict, bool]:
    raw = payload.model_dump(mode="json")
    existing = find_submission(db, payload.submission_id)
    if existing:
        if existing.request_payload != raw:
            raise IdempotencyConflict("submission_id was already used with a different payload")
        if payload.finalize and existing.status != "completed":
            return finalize_submission(db, existing, analyzer, storage, maximum), True
        return response_for(db, existing, duplicate=True), True

    details = dict(payload.complaint_details)
    details.setdefault("channel", "WhatsApp")
    details["sourceIntegration"] = {
        "name": "bhumika",
        "conversationId": payload.conversation_id,
        "reporterExternalId": payload.reporter.external_id,
        "reporterDisplayName": payload.reporter.display_name,
        "preferredLanguage": payload.reporter.preferred_language,
        "consentToProcess": payload.reporter.consent_to_process,
    }
    case = build_case(db, ComplaintCreate(
        description=payload.description,
        complaint_details=details,
        evidence=payload.evidence,
        source_channel="bhumika_whatsapp",
    ))
    case["status"] = "Processing" if payload.finalize else "Evidence pending"
    complaint = sync_case(db, case, source_channel="bhumika_whatsapp")
    submission = IntegrationSubmission(
        source="bhumika",
        external_submission_id=payload.submission_id,
        external_conversation_id=payload.conversation_id,
        complaint_id=complaint.id,
        status="received" if payload.finalize else "evidence_pending",
        request_payload=raw,
    )
    db.add(submission)
    record_event(
        db,
        "bhumika.submission_received",
        "A curated complaint was received from Bhumika.",
        complaint.id,
        actor_type="bhumika",
        data={"submission_id": payload.submission_id, "conversation_id": payload.conversation_id},
    )
    db.commit()
    if payload.finalize:
        return finalize_submission(db, submission, analyzer, storage, maximum), False
    return response_for(db, submission), False
