from urllib.parse import quote

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import create_tracking_token
from app.db.models import AuditEvent, Complaint, Report, RoutingDecision


PUBLIC_EVENT_LABELS = {
    "complaint.created": ("Complaint registered", "Your complaint was registered for review."),
    "bhumika.submission_received": ("Information received", "Niriksh received the information collected by Bhumika."),
    "evidence.stored": ("Evidence received", "Supporting evidence was stored securely."),
    "analysis.completed": ("Analysis prepared", "The information and evidence were organised for human review."),
    "analysis.fallback": ("Initial review prepared", "The complaint was organised using the available review process."),
    "report.created": ("Report prepared", "A structured complaint report was prepared."),
    "bhumika.submission_completed": ("Submitted for review", "The complaint is ready for the Niriksh review team."),
    "routing.decision": ("Review route updated", "The complaint's review route was updated."),
    "complaint.updated": ("Case updated", "An authorised reviewer updated the case."),
    "bhumika.supplement_completed": ("Additional information received", "Additional information was added to the complaint."),
}


def tracking_link_for(complaint: Complaint, settings: Settings) -> str:
    token = create_tracking_token(complaint.id, complaint.reference, complaint.created_at, settings)
    return f"{settings.public_app_url.rstrip('/')}/track?token={quote(token, safe='')}"


def victim_message_for(complaint: Complaint, tracking_url: str) -> str:
    if complaint.status == "Needs information":
        status_text = "The review team needs some additional information."
    elif complaint.status == "Routed":
        status_text = "Your complaint has been routed to the appropriate review team."
    elif complaint.status == "Resolved":
        status_text = "The Niriksh review for this complaint has been marked resolved."
    else:
        status_text = f"Your complaint is currently marked: {complaint.status}."
    return (
        "Your complaint has been registered for Niriksh review.\n"
        f"Tracking number: {complaint.reference}\n"
        f"{status_text}\n"
        f"Track updates: {tracking_url}"
    )


def public_updates(db: Session, complaint_id: str, after=None) -> list[dict]:
    query = select(AuditEvent).where(AuditEvent.complaint_id == complaint_id).order_by(AuditEvent.created_at.asc())
    if after is not None:
        query = query.where(AuditEvent.created_at > after)
    updates = []
    for event in db.scalars(query).all():
        public = PUBLIC_EVENT_LABELS.get(event.event_type)
        if not public:
            continue
        updates.append({
            "id": event.id,
            "type": event.event_type,
            "label": public[0],
            "message": public[1],
            "created_at": event.created_at,
        })
    return updates


def public_tracking_payload(db: Session, complaint: Complaint) -> dict:
    case = complaint.case_payload or {}
    analysis = case.get("analysisDetails") or {}
    routing = analysis.get("routing") or {}
    requested = case.get("missing") or []
    report = db.scalar(select(Report).where(Report.complaint_id == complaint.id).order_by(Report.version.desc()))
    decision = db.scalar(
        select(RoutingDecision).where(RoutingDecision.complaint_id == complaint.id).order_by(RoutingDecision.created_at.desc())
    )
    assigned_unit = routing.get("primaryUnit") or (case.get("department") or [None])[0]
    if decision and decision.recommendation:
        assigned_unit = (decision.recommendation.get("departments") or [assigned_unit])[0]
    return {
        "tracking_number": complaint.reference,
        "case_status": complaint.status,
        "registered_at": complaint.created_at,
        "last_updated_at": complaint.updated_at,
        "category": complaint.category,
        "assigned_unit": assigned_unit or "Cybercrime Review Unit",
        "report_prepared": report is not None,
        "report_version": report.version if report else None,
        "needs_information": complaint.status == "Needs information",
        "requested_information": requested if complaint.status == "Needs information" else [],
        "updates": public_updates(db, complaint.id),
        "guidance": [
            "Keep original evidence unchanged.",
            f"Use tracking number {complaint.reference} whenever you contact the review team.",
            "Call 1930 immediately for recent financial loss, or 112 if anyone is in immediate danger.",
        ],
        "disclaimer": "This is a Niriksh tracking record, not an FIR or confirmation of a government filing.",
    }
