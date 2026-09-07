from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_officer
from app.db.models import User
from app.modules.awareness import corpus, queue as queue_service
from app.modules.awareness.auto_run import run_auto_generate
from app.modules.awareness.mascots import MASCOT_A, MASCOT_B
from app.modules.awareness.renderer import FalH3Renderer
from app.modules.awareness.script_writer import GeminiPsaScriptWriter

router = APIRouter(prefix="/awareness/psa", tags=["awareness psa"], dependencies=[Depends(require_officer)])


@router.get("/mascots")
def mascots() -> dict:
    return {"mascot_a": MASCOT_A, "mascot_b": MASCOT_B}


@router.get("/stories")
def stories() -> list[dict]:
    return corpus.list_stories()


class ScriptRequest(BaseModel):
    story_id: str


@router.post("/script")
def generate_script(payload: ScriptRequest, request: Request) -> dict:
    story = corpus.get_story(payload.story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    writer = GeminiPsaScriptWriter(request.app.state.settings)
    try:
        beats = writer.write(story)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return {"story_id": payload.story_id, "beats": beats}


class RenderRequest(BaseModel):
    story_id: str
    beats: list[dict]


@router.post("/render")
def render(payload: RenderRequest, request: Request) -> dict:
    renderer = FalH3Renderer(request.app.state.settings)
    try:
        result = renderer.render(payload.beats)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return {"story_id": payload.story_id, **result}


class QueueRequest(BaseModel):
    story_id: str
    beats: list[dict]
    render: dict


@router.post("/queue")
def enqueue_for_review(payload: QueueRequest, db: Session = Depends(get_db)) -> dict:
    story = corpus.get_story(payload.story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    return queue_service.enqueue(db, story, payload.beats, payload.render, source="manual")


@router.get("/queue")
def list_queue(status: str | None = None, db: Session = Depends(get_db)) -> list[dict]:
    return queue_service.list_queue(db, status)


class ReviewRequest(BaseModel):
    decision: str
    note: str | None = None


@router.post("/queue/{item_id}/review")
def review_queue_item(item_id: str, payload: ReviewRequest, request: Request, db: Session = Depends(get_db), user: User | None = Depends(require_officer)) -> dict:
    try:
        return queue_service.review(db, item_id, payload.decision, payload.note, user, request.app.state.settings)
    except LookupError:
        raise HTTPException(status_code=404, detail="Queue item not found") from None
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


class AutoRunRequest(BaseModel):
    source: str = "manual_button"


@router.post("/auto-run")
def auto_run(payload: AutoRunRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    """One job: pick a story, write a script, render it, drop it in the officer
    queue. Called by the lab's "Run now" button and equally by any external
    scheduler (cron, an event-driven runner, whatever you're already using) --
    there's no in-process scheduler here on purpose. Pass source="scheduled" (or
    any label) if you want scheduled runs to show differently in the queue."""
    try:
        return run_auto_generate(db, request.app.state.settings, source=payload.source)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
