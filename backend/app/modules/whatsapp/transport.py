import logging
import uuid

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)


class WhatsAppTransport:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def configured(self) -> bool:
        return bool(self.settings.whatsapp_access_token and self.settings.whatsapp_phone_number_id)

    def _post(self, body: dict) -> dict:
        if not self.configured:
            logger.info("WhatsApp fixture send: %s", body)
            return {"fixture": True, "messages": [{"id": f"fixture-{uuid.uuid4()}"}]}
        url = (
            f"https://graph.facebook.com/{self.settings.whatsapp_graph_version}/"
            f"{self.settings.whatsapp_phone_number_id}/messages"
        )
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {self.settings.whatsapp_access_token}"},
            json=body,
            timeout=20,
        )
        response.raise_for_status()
        return response.json()

    def send_text(self, to: str, text: str) -> dict:
        return self._post({"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": text[:4096]}})

    def send_buttons(self, to: str, text: str) -> dict:
        return self._post({
            "messaging_product": "whatsapp",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": text[:1024]},
                "action": {"buttons": [
                    {"type": "reply", "reply": {"id": "send_now", "title": "Submit report"}},
                    {"type": "reply", "reply": {"id": "add_details", "title": "Add details"}},
                ]},
            },
        })

    def download_media(self, media_id: str, maximum: int | None = None) -> tuple[bytes, str] | None:
        """Resolve a Meta media ID and download it using the same Cloud API token."""
        if not self.configured or not media_id:
            return None
        headers = {"Authorization": f"Bearer {self.settings.whatsapp_access_token}"}
        metadata = httpx.get(
            f"https://graph.facebook.com/{self.settings.whatsapp_graph_version}/{media_id}",
            headers=headers,
            timeout=20,
        )
        metadata.raise_for_status()
        media = metadata.json()
        with httpx.stream("GET", media["url"], headers=headers, timeout=30) as response:
            response.raise_for_status()
            declared_size = int(response.headers.get("content-length", "0") or 0)
            if maximum and declared_size > maximum:
                raise ValueError("too_large")
            content = bytearray()
            for chunk in response.iter_bytes():
                content.extend(chunk)
                if maximum and len(content) > maximum:
                    raise ValueError("too_large")
            mime_type = media.get("mime_type") or response.headers.get("content-type") or "application/octet-stream"
            return bytes(content), mime_type
