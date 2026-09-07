from app.core.config import Settings
from app.modules.awareness.publishers.instagram import InstagramPublisher
from app.modules.awareness.publishers.whatsapp import WhatsAppPublisher
from app.modules.awareness.publishers.youtube import YouTubePublisher


def publish_to_configured_channels(settings: Settings, queue_item) -> dict:
    """Called once, right after an officer approves a queue item. Skips (does not
    fail) any channel whose credentials aren't set -- see plan-awareness-psa.md,
    Phase 3, and each publisher module for what "configured" needs."""
    caption = queue_item.story_title
    results: dict = {}

    youtube = YouTubePublisher(settings)
    if youtube.configured:
        results["youtube"] = youtube.publish(queue_item.video_url, caption, caption)
    else:
        results["youtube"] = {"ok": False, "reason": "not_configured"}

    instagram = InstagramPublisher(settings)
    if instagram.configured:
        results["instagram"] = instagram.publish(queue_item.video_url, caption)
    else:
        results["instagram"] = {"ok": False, "reason": "not_configured"}

    results["whatsapp"] = WhatsAppPublisher().publish(queue_item.video_url, caption)

    return results
