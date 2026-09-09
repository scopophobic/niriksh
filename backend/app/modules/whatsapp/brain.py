import httpx

from app.core.config import Settings


class TurnEngineError(RuntimeError):
    """The internal Next.js turn engine call failed or wasn't configured."""


def call_turn_engine(settings: Settings, payload: dict) -> dict:
    """POSTs one WhatsApp conversation turn to Niriksh's own Next.js app, which owns the actual
    conversation brain (lib/whatsapp-chat-engine.ts) -- the exact same code path the /whatsapp
    mock demo uses. Python never reimplements what to ask/say next; it only calls this.

    Raises on any failure so the caller (process_webhook_event) lets the WebhookEvent be marked
    failed and retried with its existing backoff -- no separate retry logic needed here.
    """
    if not settings.whatsapp_internal_key:
        raise TurnEngineError("WHATSAPP_INTERNAL_KEY is not configured")
    url = f"{settings.whatsapp_internal_url.rstrip('/')}/api/internal/whatsapp/turn"
    # This call runs in a BackgroundTask, well after Meta's webhook POST already got its 202 --
    # nothing external is waiting on this deadline. runChatTurn() can try up to three Gemini
    # models in sequence (lib/whatsapp-classifier.ts), and a "thinking"-enabled model doing
    # structured multimodal extraction routinely takes longer than a trivial prompt does, so 30s
    # was too tight for legitimate (not stuck) calls and was killing real turns.
    response = httpx.post(
        url,
        headers={"X-Niriksh-Internal-Key": settings.whatsapp_internal_key},
        json=payload,
        timeout=90,
    )
    if response.status_code != 200:
        raise TurnEngineError(f"turn engine returned HTTP {response.status_code}: {response.text[:500]}")
    return response.json()
