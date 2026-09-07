"""Instagram Graph API Reels publish (container-create, poll, publish).

Setup (once, needs a Meta Business account and an Instagram professional account
linked to a Facebook Page): create a Meta app, add the Instagram Graph API product,
add your own account as an app tester/admin (this works immediately, no App Review
needed for your own account -- App Review is only required to publish on OTHER
people's accounts), and generate a long-lived access token with
instagram_content_publish permission. Save INSTAGRAM_ACCESS_TOKEN and
INSTAGRAM_BUSINESS_ACCOUNT_ID (the IG user id, not the Facebook Page id).
"""

import time

import httpx

from app.core.config import Settings

GRAPH_BASE = "https://graph.facebook.com/v25.0"


class InstagramPublisher:
    def __init__(self, settings: Settings):
        self.access_token = settings.instagram_access_token
        self.account_id = settings.instagram_business_account_id

    @property
    def configured(self) -> bool:
        return bool(self.access_token and self.account_id)

    def publish(self, video_url: str, caption: str) -> dict:
        if not self.configured:
            return {"ok": False, "reason": "not_configured"}

        create = httpx.post(f"{GRAPH_BASE}/{self.account_id}/media", data={
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption[:2200],
            "access_token": self.access_token,
        }, timeout=30.0)
        if create.status_code >= 400:
            return {"ok": False, "reason": f"instagram_create_error:{create.status_code}:{create.text[:300]}"}
        container_id = create.json()["id"]

        deadline = time.monotonic() + 120
        status_code = None
        while time.monotonic() < deadline:
            status = httpx.get(f"{GRAPH_BASE}/{container_id}", params={"fields": "status_code", "access_token": self.access_token}, timeout=20.0)
            status.raise_for_status()
            status_code = status.json().get("status_code")
            if status_code == "FINISHED":
                break
            if status_code == "ERROR":
                return {"ok": False, "reason": "instagram_container_processing_error"}
            time.sleep(3.0)
        else:
            return {"ok": False, "reason": f"instagram_container_timed_out:{status_code}"}

        publish = httpx.post(f"{GRAPH_BASE}/{self.account_id}/media_publish", data={
            "creation_id": container_id,
            "access_token": self.access_token,
        }, timeout=30.0)
        if publish.status_code >= 400:
            return {"ok": False, "reason": f"instagram_publish_error:{publish.status_code}:{publish.text[:300]}"}
        media_id = publish.json().get("id")
        return {"ok": True, "media_id": media_id}
