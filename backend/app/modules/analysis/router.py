from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_officer
from app.db.models import AnalysisRun, Complaint
from app.modules.analysis.engine import analysis_engine
from app.modules.audit.service import record_event

router = APIRouter(prefix="/complaints/{complaint_id}/analysis-runs", tags=["analysis"], dependencies=[Depends(require_officer)])


@router.post("", status_code=201)
def run_analysis(complaint_id: str, db: Session = Depends(get_db)) -> dict:
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    case = dict(complaint.case_payload or {})
    result = analysis_engine.analyze(
        complaint.description,
        len(case.get("evidence", [])),
        case.get("complaintDetails", {}),
    ).result
    run = AnalysisRun(
        complaint_id=complaint.id,
        status="completed",
        provider=analysis_engine.provider,
        input_version=complaint.version,
        result=result,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(run)
    case.update({
        "summary": result["summary"], "category": result["category"], "secondary": result["secondary"],
        "severity": result["severity"], "severityScore": result["score"], "completeness": result["completeness"],
        "aiSuspected": result["aiSuspected"], "department": result["departments"], "entities": result["entities"],
        "missing": result["missing"], "riskFactors": result["riskFactors"], "confidence": result["confidence"],
        "analysisDetails": result,
    })
    complaint.case_payload = case
    complaint.summary = result["summary"]
    complaint.category = result["category"]
    complaint.severity = result["severity"]
    complaint.severity_score = result["score"]
    complaint.completeness = result["completeness"]
    complaint.confidence = result["confidence"]
    complaint.version += 1
    record_event(db, "analysis.completed", "A new policy analysis run completed.", complaint.id, actor_type="analysis", data={"analysis_run_id": run.id})
    db.commit()
    return {"id": run.id, "status": run.status, "provider": run.provider, "input_version": run.input_version, "result": result}

