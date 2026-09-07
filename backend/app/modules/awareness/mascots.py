"""Placeholder mascots for the two-character PSA pipeline.

These are NOT real product content. They exist only to prove that scripting and
rendering work end to end (plan-awareness-psa.md, Milestone 2 lists this as a required
product input). Replace name/voice/character_sheet with real values before anything
generated with these mascots ships publicly.

Each mascot is described in text (character_sheet) so the pipeline works with plain
text-to-video today. `sprite_url` is optional: run scripts/generate_mascot_sprites.py
once (needs FAL_KEY) to generate a real reference image per mascot from that same
text description -- once both sprite_urls are set, renderer.py automatically switches
to image-referenced rendering, which locks visual identity far more reliably than text
description alone.
"""

import json
from pathlib import Path

SPRITE_FILE = Path(__file__).with_name("mascot_sprites.json")

MASCOT_A = {
    "id": "mascot_a",
    "name": "PLACEHOLDER MASCOT — the mark",
    "voice": "a slightly nervous, eager-to-please adult voice, medium pitch, quick to trust",
    "character_sheet": [
        "1. A round orange blob body, no visible limbs below the shoulders, soft and bouncy.",
        "2. Two big round trusting eyes, always slightly too wide open.",
        "3. Small worried eyebrows that lift whenever a phone or message appears on screen.",
        "4. Flat 2D cel art, solid orange fill, thin black ink outline, no gradients.",
    ],
    "sprite_url": None,
}

MASCOT_B = {
    "id": "mascot_b",
    "name": "PLACEHOLDER MASCOT — the smart one",
    "voice": "a calm, dry, slightly amused adult voice, medium-low pitch, unhurried delivery",
    "character_sheet": [
        "1. A teal blob body shaped like a rounded shield, same size and proportions as the orange mascot.",
        "2. Narrow, half-lidded, skeptical eyes.",
        "3. One eyebrow permanently raised.",
        "4. Flat 2D cel art, solid teal fill, thin black ink outline, matching the other mascot's render style exactly.",
    ],
    "sprite_url": None,
}

STYLE = (
    "flat 2D cel-animated PSA short: bold black outlines, solid flat colour fills, a simple "
    "geometric background, bright even daytime lighting, no gradients, no 3D, no photorealism; "
    "comedic timing with snappy held poses between lines"
)

MASCOTS_BY_ID = {MASCOT_A["id"]: MASCOT_A, MASCOT_B["id"]: MASCOT_B}

if SPRITE_FILE.exists():
    _sprites = json.loads(SPRITE_FILE.read_text(encoding="utf-8"))
    MASCOT_A["sprite_url"] = _sprites.get("mascot_a") or None
    MASCOT_B["sprite_url"] = _sprites.get("mascot_b") or None
