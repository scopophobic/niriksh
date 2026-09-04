import hashlib
import hmac
import json
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.exc import IntegrityError

from app.db.models import WebhookEvent
from app.modules.whatsapp.service import process_webhook_event

router = APIRouter(prefix="/channels/whatsapp", tags=["whatsapp"])


@router.get("/webhook", response_class=PlainTextResponse)
def verify_webhook(
    request: Request,
    hub_mode: str = Query(alias="hub.mode"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
    hub_challenge: str = Query(alias="hub.challenge"),
):
    settings = request.app.state.settings
    if hub_mode == "subscribe" and hmac.compare_digest(hub_verify_token, settings.whatsapp_verify_token):
        return hub_challenge
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/webhook", status_code=202)
async def receive_webhook(request: Request, background: BackgroundTasks) -> dict:
    raw = await request.body()
    settings = request.app.state.settings
    signature = request.headers.get("x-hub-signature-256", "")
    if settings.whatsapp_app_secret:
        expected = "sha256=" + hmac.new(settings.whatsapp_app_secret.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    try:
        payload = json.loads(raw or b"{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Webhook body must be JSON") from None

    message_ids = [message.get("id") for entry in payload.get("entry", []) for change in entry.get("changes", []) for message in change.get("value", {}).get("messages", []) if message.get("id")]
    provider_event_id = message_ids[0] if message_ids else request.headers.get("x-request-id") or str(uuid.uuid4())
    with request.app.state.database.session_factory() as db:
        event = WebhookEvent(provider="whatsapp", external_event_id=provider_event_id, payload=payload)
        db.add(event)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return {"accepted": True, "duplicate": True}
        event_id = event.id
    if settings.process_webhooks_inline:
        background.add_task(process_webhook_event, request.app, event_id)
    return {"accepted": True, "event_id": event_id}
