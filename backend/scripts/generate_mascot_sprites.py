"""One-time helper: turn each mascot's text character_sheet into a real reference
image via fal's flux/dev, and save the URLs so renderer.py picks them up automatically.

Usage (from backend/):
    FAL_KEY=... python3 scripts/generate_mascot_sprites.py

This costs a small, real fal.ai charge per image (flux/dev text-to-image) -- run it
deliberately, not as part of any automated pipeline. Re-run any time to regenerate a
sprite (e.g. after editing a character_sheet in mascots.py).
"""

import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.modules.awareness.mascots import MASCOT_A, MASCOT_B, SPRITE_FILE, STYLE  # noqa: E402

IMAGE_MODEL = "fal-ai/flux/dev"


def sprite_prompt(mascot: dict) -> str:
    lines = "\n".join(mascot["character_sheet"])
    return (
        f"Single character reference sheet. Full body, front-facing, standing pose, "
        f"centered, plain flat white background, no other objects, no text.\n{lines}\n"
        f"STYLE: {STYLE}."
    )


def generate(settings, mascot: dict) -> str:
    if not settings.fal_key:
        raise RuntimeError("FAL_KEY is not configured")
    response = httpx.post(
        f"https://fal.run/{IMAGE_MODEL}",
        headers={"Authorization": f"Key {settings.fal_key}", "Content-Type": "application/json"},
        json={"prompt": sprite_prompt(mascot), "image_size": "square_hd"},
        timeout=60.0,
    )
    response.raise_for_status()
    result = response.json()
    return result["images"][0]["url"]


def main() -> None:
    settings = get_settings()
    sprites = {
        "mascot_a": generate(settings, MASCOT_A),
        "mascot_b": generate(settings, MASCOT_B),
    }
    SPRITE_FILE.write_text(json.dumps(sprites, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {SPRITE_FILE}")
    for key, url in sprites.items():
        print(f"  {key}: {url}")
    print("\nRestart the backend to pick these up -- renderer.py will switch to "
          "image-referenced rendering automatically once both sprite_urls are set.")


if __name__ == "__main__":
    main()
