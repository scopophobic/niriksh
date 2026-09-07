"""The one job behind POST /awareness/psa/auto-run: pick a story, write a script,
render it, and drop the result in the officer queue. Nothing here publishes anything
-- enqueue() always lands on status="pending_review". Called by the lab's "Run now"
button and equally by any external scheduler you point at that endpoint -- there is
deliberately no in-process scheduler in this codebase (see app/worker.py)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import PsaQueueItem
from app.modules.awareness import corpus
from app.modules.awareness.queue import enqueue
from app.modules.awareness.renderer import FalH3Renderer
from app.modules.awareness.script_writer import GeminiPsaScriptWriter


def _next_story(db: Session) -> dict | None:
    stories = corpus.list_stories()
    if not stories:
        return None
    used_ids = set(db.scalars(select(PsaQueueItem.story_id)).all())
    for story in stories:
        if story["id"] not in used_ids:
            return story
    return stories[0]


def run_auto_generate(db: Session, settings: Settings, source: str) -> dict:
    story = _next_story(db)
    if not story:
        raise RuntimeError("No researched stories available in docs/research/corpus")
    beats = GeminiPsaScriptWriter(settings).write(story)
    render = FalH3Renderer(settings).render(beats)
    return enqueue(db, story, beats, render, source=source)
