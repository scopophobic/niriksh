"""YouTube Data API v3 upload. Needs a one-time OAuth consent from the channel owner
to obtain YOUTUBE_REFRESH_TOKEN -- that step needs a browser and only the account
owner can grant it, so it can't be done from here. Everything else is automatic.

Setup (once): create a Google Cloud project, enable the YouTube Data API v3, create
an OAuth client (Desktop app type is simplest), and run any standard OAuth installed-
app flow requesting the https://www.googleapis.com/auth/youtube.upload scope against
your own channel. Save the resulting refresh token as YOUTUBE_REFRESH_TOKEN.
"""

import json

import httpx

from app.core.config import Settings

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"


class YouTubePublisher:
    def __init__(self, settings: Settings):
        self.client_id = settings.youtube_client_id
        self.client_secret = settings.youtube_client_secret
        self.refresh_token = settings.youtube_refresh_token
        self.category_id = settings.youtube_category_id
        self.privacy_status = settings.youtube_privacy_status

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.refresh_token)

    def _access_token(self) -> str:
        response = httpx.post(TOKEN_URL, data={
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": self.refresh_token,
            "grant_type": "refresh_token",
        }, timeout=20.0)
        response.raise_for_status()
        return response.json()["access_token"]

    def publish(self, video_url: str, title: str, description: str) -> dict:
        if not self.configured:
            return {"ok": False, "reason": "not_configured"}
        access_token = self._access_token()
        video_bytes = httpx.get(video_url, timeout=60.0).content

        metadata = {
            "snippet": {
                "title": title[:100],
                "description": description[:5000],
                "categoryId": self.category_id,
            },
            "status": {"privacyStatus": self.privacy_status},
        }
        files = {
            "metadata": (None, json.dumps(metadata), "application/json; charset=UTF-8"),
            "media": ("psa.mp4", video_bytes, "video/mp4"),
        }
        response = httpx.post(
            UPLOAD_URL,
            params={"uploadType": "multipart", "part": "snippet,status"},
            headers={"Authorization": f"Bearer {access_token}"},
            files=files,
            timeout=120.0,
        )
        if response.status_code >= 400:
            return {"ok": False, "reason": f"youtube_error:{response.status_code}:{response.text[:300]}"}
        video_id = response.json().get("id")
        return {"ok": True, "video_id": video_id, "url": f"https://www.youtube.com/watch?v={video_id}"}
