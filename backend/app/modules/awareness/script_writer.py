import json
import logging

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)

BEATS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "beats": {
            "type": "array",
            "minItems": 2,
            "maxItems": 4,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "scene_number": {"type": "integer"},
                    "visual_action": {"type": "string"},
                    "speaker": {"type": "string", "enum": ["mascot_a", "mascot_b"]},
                    "line": {"type": "string"},
                },
                "required": ["scene_number", "visual_action", "speaker", "line"],
            },
        }
    },
    "required": ["beats"],
}

INSTRUCTIONS = """You write short comedy-skit beats for a 10-second scam-awareness PSA with two \
recurring mascots: mascot_a always falls for the scam, mascot_b is the smarter one who catches \
it. You are given a scrubbed scam story with no real names, phone numbers, or account details.
Never introduce a name, phone number, bank name, UPI ID, or any identifying detail that is not \
already present in the supplied story. Keep it funny, keep it to 2-4 short beats totalling about \
ten seconds of screen time, and end on the tell -- the one detail that gives the scam away.
Return only JSON matching the supplied schema."""


class GeminiPsaScriptWriter:
    provider = "Gemini"

    def __init__(self, settings: Settings):
        self.api_key = settings.gemini_api_key
        self.models = list(dict.fromkeys([settings.gemini_model, settings.gemini_fallback_model, settings.gemini_reserve_model]))
        self.timeout = settings.gemini_timeout_seconds

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def write(self, story: dict) -> list[dict]:
        if not self.configured:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        prompt = (
            "Scam story (already scrubbed of identifying detail):\n"
            f"Category: {story.get('scam_category', '')}\n"
            f"Mechanism: {story.get('mechanism_summary', '')}\n"
            f"Suggested beats: {json.dumps(story.get('suggested_beats', []), ensure_ascii=False)}\n"
            f"Who falls for it: {story.get('who_falls_for_it_archetype', '')}\n"
            f"Why it works: {story.get('why_it_works', '')}\n\n"
            "Write the PSA beats now."
        )
        body = {
            "systemInstruction": {"parts": [{"text": INSTRUCTIONS}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": BEATS_SCHEMA,
                "maxOutputTokens": 1200,
            },
        }
        last_error: Exception | None = None
        for index, model in enumerate(self.models):
            try:
                body["generationConfig"]["thinkingConfig"] = (
                    {"thinkingBudget": 0} if model.startswith("gemini-2.5-") else {"thinkingLevel": "LOW"}
                )
                response = httpx.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    headers={"x-goog-api-key": self.api_key, "Content-Type": "application/json"},
                    json=body,
                    timeout=min(self.timeout, (15.0, 20.0, 20.0)[min(index, 2)]),
                )
                response.raise_for_status()
                payload = response.json()
                raw = payload["candidates"][0]["content"]["parts"][0]["text"]
                result = json.loads(raw)
                beats = result.get("beats")
                if not isinstance(beats, list) or not beats:
                    raise ValueError("Script writer returned no beats")
                return beats
            except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as error:
                last_error = error
                logger.warning("PSA script generation failed with model %s: %s", model, error)
        raise RuntimeError("PSA script generation was unavailable") from last_error
