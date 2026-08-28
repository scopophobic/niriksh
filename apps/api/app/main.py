import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import ComplaintAnalysis, ComplaintAnalysisRequest, DecisionRequest, LoginRequest
from app.services.analysis import analysis_service

app = FastAPI(title="Niriksh Evidence Intelligence API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])


def internal_role(x_demo_role: str | None = Header(default=None)) -> str:
    if x_demo_role not in {"triage", "admin"}:
        raise HTTPException(status_code=403, detail="Internal role required")
    return x_demo_role


@app.get("/health")
def health() -> dict:
    return {"status": "healthy", "service": "niriksh-api", "mode": "deterministic-demo"}


@app.post("/api/v1/auth/login")
def login(payload: LoginRequest) -> dict:
    accounts = {"triage@example.local": "triage", "admin@example.local": "admin"}
    role = accounts.get(payload.email.lower())
    expected = os.getenv("DEMO_TRIAGE_PASSWORD", "demo-only-change-me")
    if not role or payload.password != expected:
        raise HTTPException(status_code=401, detail="Invalid demo credentials")
    return {"access_token": f"demo-{role}-token", "token_type": "bearer", "role": role}


@app.post("/api/v1/complaints/analyze", response_model=ComplaintAnalysis)
def analyze(payload: ComplaintAnalysisRequest) -> ComplaintAnalysis:
    return analysis_service.analyze(payload)


@app.get("/api/v1/triage/queue")
def triage_queue(_: str = Depends(internal_role)) -> dict:
    return {"source": "frontend_seed", "message": "The interactive queue is seeded client-side for offline demo reliability."}


@app.post("/api/v1/triage/{complaint_id}/decision")
def decide(complaint_id: str, payload: DecisionRequest, role: str = Depends(internal_role)) -> dict:
    if payload.action == "override" and not payload.reason:
        raise HTTPException(status_code=422, detail="An override reason is required")
    return {"complaint_id": complaint_id, "decision": payload.model_dump(), "actor_role": role,
            "recorded_at": datetime.now(timezone.utc).isoformat(), "audit_recorded": True}
