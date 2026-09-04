from sqlalchemy.orm import Session

from app.db.models import AuditEvent, User


def record_event(
    db: Session,
    event_type: str,
    detail: str,
    complaint_id: str | None = None,
    actor: User | None = None,
    actor_type: str | None = None,
    data: dict | None = None,
) -> AuditEvent:
    event = AuditEvent(
        complaint_id=complaint_id,
        actor_id=actor.id if actor else None,
        actor_type=actor_type or (actor.role if actor else "system"),
        event_type=event_type,
        detail=detail,
        data=data or {},
    )
    db.add(event)
    return event

