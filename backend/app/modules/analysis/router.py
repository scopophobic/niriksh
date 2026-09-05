from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_officer
from app.db.models import AnalysisRun, Complaint
from app.modules.analysis.engine import analysis_engine
from app.modules.audit.service import record_event
from app.modules.analysis.service import apply_baseline_finding, persist_case

router = APIRouter(prefix="/complaints/{complaint_id}/analysis-runs", tags=["analysis"], dependencies=[Depends(require_officer)])


@router.post("", status_code=201)
def run_analysis(complaint_id: str, db: Session = Depends(get_db)) -> dict:
    complaint = db.get(Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    case = dict(complaint.case_payload or {})
    apply_baseline_finding(case)
    result = case["analysisDetails"]
    run = AnalysisRun(
        complaint_id=complaint.id,
        status="completed",
        provider=analysis_engine.provider,
        input_version=complaint.version,
        result=result,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(run)
    persist_case(complaint, case)
    record_event(db, "analysis.completed", "The structured intake was refreshed without scoring or prioritisation.", complaint.id, actor_type="analysis", data={"analysis_run_id": run.id})
    db.commit()
    return {"id": run.id, "status": run.status, "provider": run.provider, "input_version": run.input_version, "result": result}
