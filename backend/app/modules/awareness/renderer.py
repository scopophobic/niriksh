import time

import httpx

from app.core.config import Settings
from app.modules.awareness.mascots import MASCOT_A, MASCOT_B, STYLE

QUEUE_BASE = "https://queue.fal.run"

# H3's own prompt rewriter compresses prose but copies numbered lists verbatim -- see
# internetphysics/live-classroom's TEACHER pattern. Both character sheets are kept as
# numbered lines for the same reason, in both prompt styles below.


def _character_block(mascot: dict) -> str:
    lines = "\n".join(mascot["character_sheet"])
    return f"{mascot['name']} CHARACTER SHEET (keep every numbered line exactly as written):\n{lines}\nVoice: {mascot['voice']}."


def _beat_lines(beats: list[dict], name_for) -> list[str]:
    lines = []
    for beat in beats:
        name = name_for(beat.get("speaker"))
        lines.append(
            f"Beat {beat.get('scene_number')}: {str(beat.get('visual_action', '')).strip()}. "
            f"{name} says, with visible lip sync: \"{str(beat.get('line', '')).strip()}\""
        )
    return lines


def compile_text_prompt(beats: list[dict]) -> str:
    """Text-only rendering: visual identity comes entirely from the numbered
    character sheets, repeated in full every render."""
    name_for = lambda speaker: MASCOT_A["name"] if speaker == "mascot_a" else MASCOT_B["name"]  # noqa: E731
    return "\n\n".join([
        _character_block(MASCOT_A),
        _character_block(MASCOT_B),
        "Ten-second 16:9 two-character comedy PSA. Both characters are drawn exactly the same in every beat.",
        "\n".join(_beat_lines(beats, name_for)),
        f"STYLE (mandatory): {STYLE}. Never 3D, never CGI, never photorealistic.",
    ])


def compile_reference_prompt(beats: list[dict]) -> str:
    """Image-referenced rendering: Image 1 / Image 2 carry visual identity, the
    character sheet text is kept only as a lip-sync/behaviour reinforcement."""
    name_for = lambda speaker: "Image 1" if speaker == "mascot_a" else "Image 2"  # noqa: E731
    return "\n\n".join([
        f"Image 1 is {MASCOT_A['name']}. Voice: {MASCOT_A['voice']}.",
        f"Image 2 is {MASCOT_B['name']}. Voice: {MASCOT_B['voice']}.",
        "Ten-second 16:9 two-character comedy PSA. Keep both characters' appearance exactly as shown in their reference image in every beat.",
        "\n".join(_beat_lines(beats, name_for)),
        f"STYLE (mandatory): {STYLE}. Never 3D, never CGI, never photorealistic.",
    ])


class FalH3Renderer:
    """One-shot render: a batch PSA asset, not a live stream, so no runway/queue of
    clips like live-classroom -- see plan-awareness-psa.md, Development Principle 3.

    Uses image-referenced rendering automatically once both mascots have a
    sprite_url (see scripts/generate_mascot_sprites.py); falls back to text-only
    rendering otherwise, so the pipeline works before any sprite exists.
    """

    def __init__(self, settings: Settings):
        self.api_key = settings.fal_key
        self.text_model = settings.fal_h3_model
        self.reference_model = settings.fal_h3_reference_model
        self.seed = 271_828

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    @property
    def _use_references(self) -> bool:
        return bool(MASCOT_A.get("sprite_url") and MASCOT_B.get("sprite_url"))

    def render(self, beats: list[dict], resolution: str = "480P") -> dict:
        if not self.configured:
            raise RuntimeError("FAL_KEY is not configured")

        if self._use_references:
            model = self.reference_model
            prompt = compile_reference_prompt(beats)
            body = {
                "prompt": prompt,
                "reference_image_urls": [MASCOT_A["sprite_url"], MASCOT_B["sprite_url"]],
                "duration": 10,
                "resolution": resolution,
                "aspect_ratio": "16:9",
                "seed": self.seed,
                "prompt_expansion_mode": "balanced",
            }
            cost_cents = 50 if resolution == "480P" else 80
        else:
            model = self.text_model
            prompt = compile_text_prompt(beats)
            body = {
                "prompt": prompt,
                "duration": 10,
                "resolution": resolution,
                "aspect_ratio": "16:9",
                "seed": self.seed,
                "prompt_expansion_mode": "balanced",
            }
            cost_cents = 25 if resolution == "480P" else 75

        headers = {"Authorization": f"Key {self.api_key}", "Content-Type": "application/json"}
        submit = httpx.post(f"{QUEUE_BASE}/{model}", headers=headers, json=body, timeout=30.0)
        submit.raise_for_status()
        submission = submit.json()
        request_id = submission["request_id"]
        status_url = submission.get("status_url") or f"{QUEUE_BASE}/{model}/requests/{request_id}/status"
        response_url = submission.get("response_url") or f"{QUEUE_BASE}/{model}/requests/{request_id}"

        deadline = time.monotonic() + 150
        status = None
        while time.monotonic() < deadline:
            status_response = httpx.get(status_url, headers=headers, timeout=20.0)
            status_response.raise_for_status()
            status = status_response.json().get("status")
            if status == "COMPLETED":
                break
            if status == "ERROR":
                raise RuntimeError("fal reported a render error")
            time.sleep(3.0)
        else:
            raise RuntimeError(f"fal render timed out (last status: {status})")

        result_response = httpx.get(response_url, headers=headers, timeout=20.0)
        result_response.raise_for_status()
        result = result_response.json()
        video_url = result["video"]["url"]
        return {
            "video_url": video_url,
            "duration_seconds": 10,
            "resolution": resolution,
            "cost_cents": cost_cents,
            "fal_request_id": request_id,
            "used_reference_images": self._use_references,
        }
