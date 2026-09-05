from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_officer
from app.db.models import Complaint, RoutingDecision, User
from app.modules.audit.service import record_event
from app.modules.complaints.service import update_case
from app.modules.routing.schemas import RoutingDecisionRequest

router = APIRouter(prefix="/triage", tags=["triage"], dependencies=[Depends(require_officer)])


@router.post("/{complaint_id}/decision", status_code=201)
def record_decision(
    complaint_id: str,
    payload: RoutingDecisionRequest,
    db: Session = Depends(get_db),
    actor: User | None = Depends(require_officer),
) -> dict:
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    recommendation = {"category": payload.category, "departments": payload.departments}
    decision = RoutingDecision(
        complaint_id=complaint_id,
        action=payload.action,
        recommendation=recommendation,
        reason=payload.reason,
        actor_id=actor.id if actor else None,
    )
    db.add(decision)
    patch: dict = {}
    if payload.action in {"approve", "override"}:
        patch["status"] = "Routed"
    elif payload.action == "request_information":
        patch["status"] = "Needs information"
    if payload.category:
        patch["reviewCategory"] = payload.category
    if payload.departments:
        patch["department"] = payload.departments
    update_case(db, complaint, patch, actor_type=actor.role if actor else "internal")
    record_event(db, "routing.decision", f"Routing decision recorded: {payload.action}.", complaint_id, actor=actor, data=recommendation)
    db.commit()
    return {"id": decision.id, "complaint_id": complaint_id, "action": decision.action, "recorded_at": decision.created_at}
