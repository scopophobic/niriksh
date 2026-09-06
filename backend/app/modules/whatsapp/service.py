import base64
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.models import AnalysisRun, ChannelContact, ChannelMessage, ChannelSession, Complaint, EvidenceItem, WebhookEvent
from app.modules.analysis.provider import GeminiComplaintAnalyzer, MediaInput
from app.modules.analysis.service import apply_baseline_finding, apply_connected_finding, persist_case
from app.modules.audit.service import record_event
from app.modules.complaints.schemas import ComplaintCreate, EvidenceMetadata
from app.modules.complaints.service import build_case, sync_case
from app.modules.reports.service import create_report_snapshot
from app.modules.whatsapp.parser import describe_message, extract_messages
from app.modules.whatsapp.transport import WhatsAppTransport
from app.storage import EvidenceStorage


def external_id(response: dict) -> str | None:
    messages = response.get("messages", [])
    return messages[0].get("id") if messages else None


def store_message(db: Session, session_id: str, direction: str, text: str, external_message_id: str | None, payload: dict, message_type: str = "text") -> None:
    if external_message_id and db.scalar(select(ChannelMessage.id).where(
        ChannelMessage.channel == "whatsapp",
        ChannelMessage.external_message_id == external_message_id,
    )):
        return
    db.add(ChannelMessage(
        session_id=session_id,
        channel="whatsapp",
        direction=direction,
        external_message_id=external_message_id,
        message_type=message_type,
        text=text,
        payload=payload,
    ))


def get_or_create_contact(db: Session, message: dict) -> ChannelContact:
    contact = db.scalar(select(ChannelContact).where(
        ChannelContact.channel == "whatsapp",
        ChannelContact.external_id == message["from"],
    ))
    if contact is None:
        contact = ChannelContact(channel="whatsapp", external_id=message["from"], display_name=message.get("display_name"))
        db.add(contact)
        db.flush()
    elif message.get("display_name") and not contact.display_name:
        contact.display_name = message["display_name"]
    return contact


def open_session(db: Session, contact: ChannelContact) -> ChannelSession | None:
    return db.scalar(select(ChannelSession).where(
        ChannelSession.contact_id == contact.id,
        ChannelSession.state == "collecting",
    ).order_by(ChannelSession.last_message_at.desc()))


def latest_session(db: Session, contact: ChannelContact) -> ChannelSession | None:
    return db.scalar(select(ChannelSession).where(
        ChannelSession.contact_id == contact.id,
        ChannelSession.complaint_id.is_not(None),
    ).order_by(ChannelSession.last_message_at.desc()))


def immediate_guidance(case: dict) -> str:
    details = case.get("complaintDetails") or {}
    financial = details.get("financial") or {}
    if financial.get("involved") or "financial" in case.get("category", "").lower():
        return "For recent financial cyber fraud in India, contact your bank/payment provider and call 1930 immediately."
    return "If anyone is in immediate danger, contact local emergency services."


def compose_prompt(case: dict) -> str:
    missing = case.get("missing", [])
    if not missing:
        ask = "The report has the main details. Add anything else, or submit it for officer review."
    else:
        ask = "Helpful next detail: " + missing[0] + ". Reply with it, attach evidence, or submit now."
    return (
        f"Niriksh saved this as {case['reference']}.\n"
        f"Subject folder: {case['category']}\n"
        f"Information checklist: {case['completeness']}% complete\n\n{ask}\n\n"
        f"The folder is selected by a person and requires officer confirmation. {immediate_guidance(case)}"
    )


def normalized_expected_digest(value: str | None) -> str | None:
    if not value:
        return None
    if re.fullmatch(r"[a-fA-F0-9]{64}", value):
        return value.lower()
    try:
        raw = base64.b64decode(value, validate=True)
        return raw.hex() if len(raw) == 32 else None
    except (ValueError, TypeError):
        return None


def register_message_media(db: Session, complaint: Complaint, case: dict, message: dict) -> None:
    existing_items = db.scalars(select(EvidenceItem).where(EvidenceItem.complaint_id == complaint.id)).all()
    known_ids = {(item.metadata_json or {}).get("whatsapp_media_id") for item in existing_items}
    for media in message.get("media", []):
        if media.get("id") in known_ids:
            continue
        name = media.get("filename") or f"whatsapp-{media.get('kind', 'media')}-{media.get('id', 'attachment')}"
        placeholder = next((item for item in existing_items if item.original_name == name and not item.storage_key), None)
        if placeholder:
            placeholder.metadata_json = {**(placeholder.metadata_json or {}), "whatsapp_media_id": media.get("id")}
            placeholder.status = "remote_pending"
            continue
        metadata = {
            "name": name,
            "type": (media.get("kind") or "document").title(),
            "size": "Pending download",
            "mimeType": media.get("mime_type"),
            "sha256": media.get("sha256"),
            "purpose": "Supporting evidence",
            "originality": "Original",
            "whatsapp_media_id": media.get("id"),
        }
        case.setdefault("evidence", []).append(metadata)
        db.add(EvidenceItem(
            complaint_id=complaint.id,
            original_name=metadata["name"],
            evidence_type=metadata["type"],
            mime_type=metadata.get("mimeType") or "application/octet-stream",
            display_size="Pending download",
            sha256=metadata.get("sha256") if len(metadata.get("sha256") or "") == 64 else None,
            status="remote_pending",
            purpose="Supporting evidence",
            originality="Original",
            metadata_json=metadata,
        ))
    db.flush()


def ingest_media(
    db: Session,
    complaint: Complaint,
    message: dict,
    transport: WhatsAppTransport,
    storage: EvidenceStorage,
    maximum: int,
) -> list[MediaInput]:
    inputs: list[MediaInput] = []
    for media in message.get("media", []):
        media_id = media.get("id")
        if not media_id:
            continue
        item = db.scalar(select(EvidenceItem).where(
            EvidenceItem.complaint_id == complaint.id,
            EvidenceItem.metadata_json["whatsapp_media_id"].as_string() == media_id,
        ).limit(1))
        if item is None:
            item = db.scalar(select(EvidenceItem).where(
                EvidenceItem.complaint_id == complaint.id,
                EvidenceItem.original_name == (media.get("filename") or f"whatsapp-{media.get('kind', 'media')}-{media_id}"),
                EvidenceItem.storage_key.is_(None),
            ).limit(1))
        if item is None:
            continue
        metadata = {**(item.metadata_json or {}), "whatsapp_media_id": media_id}
        item.metadata_json = metadata
        item.status = "downloading" if transport.configured else "remote_pending"
        db.flush()
        try:
            downloaded = transport.download_media(media_id, maximum)
        except ValueError as error:
            item.status = "rejected"
            item.metadata_json = {**metadata, "ingest_error": str(error)}
            record_event(db, "evidence.rejected", "WhatsApp evidence exceeded the configured size limit.", complaint.id, actor_type="whatsapp", data={"evidence_id": item.id})
            continue
        if downloaded is None:
            continue
        content, mime_type = downloaded
        extension = (mime_type.split("/", 1)[-1].split(";", 1)[0] or "bin").replace("+", "-")
        key = f"{complaint.id}/{item.id}-whatsapp.{extension}"
        try:
            stored = storage.put_bytes(key, content, maximum, normalized_expected_digest(media.get("sha256")))
        except ValueError as error:
            item.status = "rejected"
            item.metadata_json = {**metadata, "ingest_error": str(error)}
            record_event(db, "evidence.rejected", "WhatsApp evidence failed size or fingerprint validation.", complaint.id, actor_type="whatsapp", data={"evidence_id": item.id})
            continue
        item.storage_key = stored.key
        item.size_bytes = stored.size
        item.sha256 = stored.sha256
        item.mime_type = mime_type
        item.status = "stored"
        record_event(db, "evidence.stored", "WhatsApp evidence was downloaded, stored, and hashed.", complaint.id, actor_type="whatsapp", data={"evidence_id": item.id, "sha256": stored.sha256})
        inputs.append(MediaInput(item.id, item.original_name, mime_type, content))
    return inputs


def deliver_reply(
    db: Session,
    complaint: Complaint,
    session: ChannelSession,
    transport: WhatsAppTransport,
    recipient: str,
    reply: str,
    buttons: bool,
) -> None:
    try:
        response = transport.send_buttons(recipient, reply) if buttons else transport.send_text(recipient, reply)
        store_message(db, session.id, "out", reply, external_id(response), response)
    except Exception as error:
        store_message(db, session.id, "out", reply, None, {"delivery": "failed", "error_type": type(error).__name__})
        record_event(
            db,
            "whatsapp.delivery_failed",
            "The complaint was saved, but the WhatsApp reply could not be delivered.",
            complaint.id,
            actor_type="whatsapp",
            data={"error_type": type(error).__name__},
        )
    db.commit()


def process_message(
    db: Session,
    message: dict,
    transport: WhatsAppTransport,
    storage: EvidenceStorage,
    maximum: int,
    analyzer: GeminiComplaintAnalyzer | None = None,
) -> None:
    contact = get_or_create_contact(db, message)
    session = open_session(db, contact)
    inbound_text = describe_message(message)
    command = (message.get("button_id") or message.get("text") or "").strip().lower()

    if session is None and (command == "status" or command.startswith("track") or command.startswith("status ")):
        previous = latest_session(db, contact)
        if previous:
            complaint = db.get(Complaint, previous.complaint_id)
            if complaint:
                store_message(db, previous.id, "in", inbound_text, message.get("id"), message.get("raw", {}), message.get("type", "text"))
                previous.last_message_at = datetime.now(timezone.utc)
                db.commit()
                reply = (
                    f"Niriksh tracking number: {complaint.reference}\n"
                    f"Current status: {complaint.status}\n"
                    "This is Niriksh review status, not confirmation of a police or government filing."
                )
                deliver_reply(db, complaint, previous, transport, message["from"], reply, buttons=False)
                return

    if session is None:
        evidence = [EvidenceMetadata(
            name=item.get("filename") or f"whatsapp-{item.get('kind', 'media')}-{item.get('id', 'attachment')}",
            type=(item.get("kind") or "document").title(),
            size="Pending download",
            mimeType=item.get("mime_type"),
            sha256=item.get("sha256"),
            purpose="Supporting evidence",
            originality="Original",
        ) for item in message.get("media", [])]
        location = message.get("location") or {}
        details = {
            "channel": "WhatsApp",
            "accountOrUrl": message["from"],
            "incidentStatus": "Not sure",
            "reporterRole": "Person affected",
        }
        if location:
            details["district"] = location.get("name") or location.get("address")
        create = ComplaintCreate(
            description=inbound_text if len(inbound_text) >= 20 else f"The reporter sent this information over WhatsApp: {inbound_text}",
            complaint_details=details,
            evidence=evidence,
            source_channel="whatsapp",
        )
        case = build_case(db, create)
        case["status"] = "Needs information"
        complaint = sync_case(db, case, "whatsapp")
        session = ChannelSession(contact_id=contact.id, complaint_id=complaint.id, state="collecting", context={"turns": 1})
        db.add(session)
        db.flush()
    else:
        complaint = db.get(Complaint, session.complaint_id)
        if complaint is None:
            session.state = "failed"
            raise RuntimeError("WhatsApp session points to a missing complaint")
        case = dict(complaint.case_payload)
        turns = int((session.context or {}).get("turns", 1)) + 1
        session.context = {**(session.context or {}), "turns": turns}

        if command not in {"add_details", "add details", "send_now", "submit", "submit report", "send now"}:
            case["description"] = f"{case['description']}\n\nWhatsApp follow-up: {inbound_text}"

    register_message_media(db, complaint, case, message)

    store_message(db, session.id, "in", inbound_text, message.get("id"), message.get("raw", {}), message.get("type", "text"))
    media_inputs = ingest_media(db, complaint, message, transport, storage, maximum)
    session.last_message_at = datetime.now(timezone.utc)

    if command in {"send_now", "submit", "submit report", "send now"}:
        case["status"] = "Awaiting review"
        complaint.status = "Awaiting review"
        complaint.case_payload = case
        complaint.version += 1
        session.state = "submitted"
        session.closed_at = datetime.now(timezone.utc)
        report = create_report_snapshot(db, complaint)
        reply = (
            f"Submitted for Niriksh review. Your tracking number is {complaint.reference}. "
            f"Report version {report.version} has been created. An authorised reviewer must verify the report and routing."
        )
        record_event(db, "report.created", f"Report version {report.version} was generated from WhatsApp intake.", complaint.id, actor_type="whatsapp")
        db.commit()
        record_event(db, "whatsapp.submitted", "The reporter submitted the WhatsApp complaint for review.", complaint.id, actor_type="complainant")
        deliver_reply(db, complaint, session, transport, message["from"], reply, buttons=False)
        return

    apply_baseline_finding(case)
    if analyzer and analyzer.configured:
        try:
            prior_extractions = [
                f"{item.get('name', 'Evidence')}: {item.get('extractedText')}"
                for item in case.get("evidence", [])
                if item.get("extractedText")
            ]
            analysis_narrative = case["description"]
            if prior_extractions:
                analysis_narrative += "\n\nPreviously extracted evidence text:\n" + "\n".join(prior_extractions)
            connected = analyzer.analyze(analysis_narrative, case.get("complaintDetails", {}), media_inputs)
            if connected:
                apply_connected_finding(db, complaint, case, connected)
                record_event(db, "analysis.completed", "Connected multimodal intake analysis completed.", complaint.id, actor_type="analysis", data={"model": connected.model})
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
    persist_case(complaint, case)
    if session.context.get("turns", 1) > 1:
        record_event(db, "whatsapp.details_added", "The reporter added information over WhatsApp.", complaint.id, actor_type="complainant")

    reply = compose_prompt(case)
    db.commit()
    deliver_reply(db, complaint, session, transport, message["from"], reply, buttons=True)


def process_webhook_event(app, event_id: str) -> None:
    with app.state.database.session_factory() as db:
        claimed = db.execute(
            update(WebhookEvent)
            .where(WebhookEvent.id == event_id, WebhookEvent.status.in_(["received", "failed"]))
            .values(status="processing", attempt_count=WebhookEvent.attempt_count + 1)
        )
        if claimed.rowcount != 1:
            db.rollback()
            return
        db.commit()
        event = db.get(WebhookEvent, event_id)
        try:
            transport = WhatsAppTransport(app.state.settings)
            for message in extract_messages(event.payload):
                process_message(
                    db,
                    message,
                    transport,
                    app.state.evidence_storage,
                    app.state.settings.max_evidence_bytes,
                    app.state.complaint_analyzer,
                )
            event.status = "processed"
            event.processed_at = datetime.now(timezone.utc)
            event.error = None
            db.commit()
        except Exception as error:
            db.rollback()
            event = db.get(WebhookEvent, event_id)
            if event:
                event.status = "failed"
                event.error = str(error)[:2000]
                event.next_attempt_at = datetime.now(timezone.utc) + timedelta(seconds=min(300, 5 * (2 ** event.attempt_count)))
                db.commit()
            raise
