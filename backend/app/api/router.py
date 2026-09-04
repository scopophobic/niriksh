from fastapi import APIRouter

from app.modules.analysis.router import router as analysis_router
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.bhumika.router import router as bhumika_router
from app.modules.complaints.router import router as complaints_router
from app.modules.evidence.router import intake_router as intake_evidence_router, router as evidence_router
from app.modules.reports.router import router as reports_router
from app.modules.routing.router import router as routing_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(complaints_router)
api_router.include_router(evidence_router)
api_router.include_router(intake_evidence_router)
api_router.include_router(analysis_router)
api_router.include_router(reports_router)
api_router.include_router(routing_router)
api_router.include_router(audit_router)
api_router.include_router(bhumika_router)
