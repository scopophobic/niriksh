"""Deliberately not implemented as a direct send from niriksh.

There is no "WhatsApp Shorts" product, and no official Business API for posting to
WhatsApp Channels -- Meta's Cloud API does not expose Channels at all (only unofficial
third-party session gateways do, which is a different trust posture than the official
Cloud API this codebase already uses). The closest real option is broadcasting the
video as a message to an opted-in recipient list via the official Cloud API.

niriksh's own .env.example already states the ownership boundary: "Bhumika owns
Meta/WhatsApp. Niriksh accepts only curated server submissions." -- there is no
outbound-send code anywhere in app/modules/whatsapp today, only inbound webhook
handling. Building a second, competing outbound path here would contradict that.

This stays a stub until a decision is made (see TODO.md) on whether PSA distribution
should be a new capability requested through Bhumika, or a deliberate, reviewed
exception to the ownership boundary above.
"""


class WhatsAppPublisher:
    configured = False

    def publish(self, video_url: str, caption: str) -> dict:
        return {"ok": False, "reason": "not_configured: see TODO.md -- WhatsApp distribution is a Bhumika ownership question, not wired here"}
