from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Complaint, Report


def render_report(case: dict) -> str:
    analysis = case.get("analysisDetails") or {}
    routing = analysis.get("routing") or {}
    details = case.get("complaintDetails") or {}
    financial = details.get("financial") or {}
    lines = [
        "NIRIKSH — STRUCTURED CYBERCRIME COMPLAINT REPORT",
        f"Reference / tracking number: {case.get('reference', 'Unknown')}",
        f"Created: {case.get('createdAt', 'Unknown')}",
        f"Source channel: {case.get('platform') or details.get('channel') or 'Unknown'}",
        "",
        f"Summary: {case.get('summary', '')}",
        f"Analysis category: {case.get('category', 'Needs review')}",
        f"Priority: {case.get('severity', 'Needs review')} ({case.get('severityScore', 0)}/100)",
        f"Incident date/time: {details.get('incidentDate') or 'Not provided'} {details.get('incidentTime') or ''}".rstrip(),
        f"Location: {', '.join(filter(None, [details.get('district'), details.get('state')])) or 'Not provided'}",
        f"Platform/account: {details.get('accountOrUrl') or details.get('channel') or 'Not provided'}",
        f"Financial loss: {financial.get('currency', '')} {financial.get('lossAmount', 'Not provided')}".strip(),
        f"Transaction identifiers: {', '.join(financial.get('transactionIds') or []) or 'Not provided'}",
        "",
        "ROUTING RECOMMENDATION",
        f"Primary unit: {routing.get('primaryUnit', 'Human routing required')}",
        f"Supporting units: {', '.join(routing.get('supportingUnits', [])) or 'None'}",
        "",
        "Original reporter narrative:",
        case.get("description", ""),
        "",
        "This report records allegations and evidence metadata for authorised human review. It is not a final finding or confirmation that a police filing has occurred.",
    ]
    return "\n".join(lines)


def create_report_snapshot(db: Session, complaint: Complaint, created_by: str | None = None) -> Report:
    version = (db.scalar(select(func.max(Report.version)).where(Report.complaint_id == complaint.id)) or 0) + 1
    report = Report(
        complaint_id=complaint.id,
        version=version,
        content_text=render_report(complaint.case_payload),
        snapshot=complaint.case_payload,
        created_by=created_by,
    )
    db.add(report)
    db.flush()
    return report
