from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import PsaQueueItem, User
from app.modules.audit.service import record_event
from app.modules.awareness.publish import publish_to_configured_channels


def _serialize(item: PsaQueueItem) -> dict:
    return {
        "id": item.id, "story_id": item.story_id, "story_title": item.story_title,
        "beats": item.beats, "video_url": item.video_url, "resolution": item.resolution,
        "duration_seconds": item.duration_seconds, "cost_cents": item.cost_cents,
        "used_reference_images": item.used_reference_images, "source": item.source,
        "status": item.status, "review_note": item.review_note, "reviewed_at": item.reviewed_at,
        "publish_results": item.publish_results, "published_at": item.published_at,
        "created_at": item.created_at,
    }


def enqueue(db: Session, story: dict, beats: list[dict], render: dict, source: str = "manual") -> dict:
    item = PsaQueueItem(
        story_id=story["id"], story_title=story.get("title", story["id"]), beats=beats,
        video_url=render["video_url"], resolution=render["resolution"],
        duration_seconds=render["duration_seconds"], cost_cents=render["cost_cents"],
        used_reference_images=bool(render.get("used_reference_images")), source=source,
        publish_results={},
    )
    db.add(item)
    db.commit()
    record_event(db, "psa.queued", f"A PSA render for '{item.story_title}' entered the officer review queue.", actor_type=source, data={"queue_item_id": item.id})
    db.commit()
    return _serialize(item)


def list_queue(db: Session, status: str | None = None) -> list[dict]:
    query = select(PsaQueueItem).order_by(PsaQueueItem.created_at.desc())
    if status:
        query = query.where(PsaQueueItem.status == status)
    return [_serialize(item) for item in db.scalars(query).all()]


def review(db: Session, item_id: str, decision: str, note: str | None, user: User | None, settings: Settings) -> dict:
    item = db.get(PsaQueueItem, item_id)
    if not item:
        raise LookupError("Queue item not found")
    if item.status != "pending_review":
        raise ValueError(f"Item is already {item.status}, not pending review")
    if decision not in {"approve", "reject"}:
        raise ValueError("decision must be 'approve' or 'reject'")

    item.review_note = note
    item.reviewed_by = user.id if user else None
    item.reviewed_at = datetime.now(timezone.utc)

    if decision == "reject":
        item.status = "rejected"
        db.commit()
        record_event(db, "psa.rejected", f"A PSA for '{item.story_title}' was rejected.", actor=user, actor_type="officer", data={"queue_item_id": item.id, "note": note})
        db.commit()
        return _serialize(item)

    item.status = "approved"
    db.commit()
    record_event(db, "psa.approved", f"A PSA for '{item.story_title}' was approved for publishing.", actor=user, actor_type="officer", data={"queue_item_id": item.id})
    db.commit()

    results = publish_to_configured_channels(settings, item)
    item.publish_results = results
    item.status = "published" if any(result.get("ok") for result in results.values()) or not results else "publish_failed"
    item.published_at = datetime.now(timezone.utc)
    db.commit()
    record_event(db, "psa.publish_attempted", f"Publish attempted for '{item.story_title}'.", actor=user, actor_type="officer", data={"queue_item_id": item.id, "results": results})
    db.commit()
    return _serialize(item)
