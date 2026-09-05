from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AnalysisRun, Complaint, EvidenceItem
from app.modules.analysis.engine import analysis_engine
from app.modules.analysis.provider import ConnectedFinding, merge_extracted_details
from app.modules.review.policy import review_case


def apply_connected_finding(db: Session, complaint: Complaint, case: dict, connected: ConnectedFinding) -> None:
    result = connected.result
    details = merge_extracted_details(case.get("complaintDetails", {}), result.get("extracted_details", {}))
    baseline = analysis_engine.analyze(case["description"], len(case.get("evidence", [])), details).result
    indicators = [{**item, "level": "Context"} for item in result.get("important_indicators", [])]
    connected_result = {**result, "important_indicators": indicators}
    case.update({
        "summary": result["situation_summary"],
        "secondary": baseline["secondary"],
        "severity": "Needs review",
        "severityScore": baseline["score"],
        "completeness": max(baseline["completeness"], min(100, 100 - len(result.get("missing_questions", [])) * 12)),
        "aiSuspected": baseline["aiSuspected"],
        "department": baseline["departments"],
        "entities": baseline["entities"],
        "missing": result.get("missing_questions", []) or baseline["missing"],
        "riskFactors": baseline["riskFactors"],
        "confidence": 0,
        "complaintDetails": details,
        "analysisDetails": {
            **baseline,
            "connected": connected_result,
            "highlights": indicators or baseline["highlights"],
            "engine": {
                "mode": "Connected multimodal",
                "label": connected.provider,
                "model": connected.model,
                "mediaReviewed": len(result.get("evidence_findings", [])),
                "limitations": result.get("limitations", []),
            },
        },
    })
    case.update(review_case(case))
    findings_by_name = {item.get("file_name"): item for item in result.get("evidence_findings", [])}
    for evidence in db.scalars(select(EvidenceItem).where(EvidenceItem.complaint_id == complaint.id)).all():
        finding = findings_by_name.get(evidence.original_name)
        if not finding:
            continue
        transcript = finding.get("transcript")
        visible = "\n".join(finding.get("visible_text") or [])
        evidence.extracted_text = transcript or visible or evidence.extracted_text
        evidence.metadata_json = {**(evidence.metadata_json or {}), "analysis": finding}
        for case_evidence in case.get("evidence", []):
            if case_evidence.get("name") == evidence.original_name:
                case_evidence["extractedText"] = evidence.extracted_text
                case_evidence["analysis"] = finding
    db.add(AnalysisRun(
        complaint_id=complaint.id,
        status="completed",
        provider=connected.provider,
        model=connected.model,
        input_version=complaint.version,
        result=result,
        completed_at=datetime.now(timezone.utc),
    ))


def apply_baseline_finding(case: dict) -> None:
    finding = analysis_engine.analyze(case["description"], len(case.get("evidence", [])), case.get("complaintDetails", {})).result
    case.update({
        "summary": finding["summary"], "category": finding["category"], "secondary": finding["secondary"],
        "severity": finding["severity"], "severityScore": finding["score"], "completeness": finding["completeness"],
        "aiSuspected": finding["aiSuspected"], "department": finding["departments"], "entities": finding["entities"],
        "missing": finding["missing"], "riskFactors": finding["riskFactors"], "confidence": finding["confidence"],
        "analysisDetails": finding,
    })
    case.update(review_case(case))


def persist_case(complaint: Complaint, case: dict) -> None:
    case.update(review_case(case))
    complaint.description = case["description"]
    complaint.summary = case["summary"]
    complaint.category = case["category"]
    complaint.severity = case["severity"]
    complaint.severity_score = case["severityScore"]
    complaint.completeness = case["completeness"]
    complaint.confidence = case["confidence"]
    complaint.ai_suspected = case.get("aiSuspected", False)
    complaint.location = ", ".join(filter(None, [
        case.get("complaintDetails", {}).get("district"),
        case.get("complaintDetails", {}).get("state"),
    ]))
    complaint.case_payload = case
    complaint.version += 1
