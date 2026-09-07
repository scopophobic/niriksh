"""Reads the research corpus produced from docs/research/astra-scam-corpus-brief.md.

No database table exists for this yet (plan-awareness-psa.md, Milestone 1 covers that).
For now this reads the JSON files directly so the scripting/rendering pipeline can be
tried end to end before the case_studies table is built.
"""

import json

from app.core.config import REPOSITORY_ROOT

CORPUS_DIR = REPOSITORY_ROOT / "docs" / "research" / "corpus"


def list_stories() -> list[dict]:
    stories: list[dict] = []
    if not CORPUS_DIR.exists():
        return stories
    for path in sorted(CORPUS_DIR.glob("*.json")):
        items = json.loads(path.read_text(encoding="utf-8"))
        for index, item in enumerate(items):
            stories.append({"id": f"{path.stem}:{index}", **item})
    return stories


def get_story(story_id: str) -> dict | None:
    return next((story for story in list_stories() if story["id"] == story_id), None)
