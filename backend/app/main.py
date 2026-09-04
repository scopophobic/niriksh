from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.models import User
from app.db.session import Database, build_database
from app.modules.analysis.provider import GeminiComplaintAnalyzer
from app.storage import build_evidence_storage


def seed_users(database: Database, settings: Settings) -> None:
    if not settings.seed_demo_users:
        return
    with database.session_factory() as db:
        for email, role in [("triage@example.local", "triage"), ("admin@example.local", "admin")]:
            if not db.scalar(select(User).where(User.email == email)):
                db.add(User(email=email, role=role, password_hash=hash_password(settings.demo_user_password)))
        db.commit()


def create_app(settings: Settings | None = None, database: Database | None = None) -> FastAPI:
    settings = settings or get_settings()
    if settings.app_env.lower() in {"production", "prod"}:
        insecure = {"local-only-change-before-deployment", "local-development-key", "replace-me"}
        if settings.jwt_secret in insecure or settings.internal_api_key in insecure:
            raise RuntimeError("Production secrets must be explicitly configured")
    settings.evidence_storage_path.mkdir(parents=True, exist_ok=True)
    if settings.database_url.startswith("sqlite:///./"):
        Path(settings.database_url.removeprefix("sqlite:///./")).parent.mkdir(parents=True, exist_ok=True)
    database = database or build_database(settings.database_url)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if settings.auto_create_tables:
            Base.metadata.create_all(database.engine)
        seed_users(database, settings)
        yield
        database.engine.dispose()

    app = FastAPI(
        title="Niriksh Cybercrime Triage API",
        version="2.0.0",
        description="Canonical backend for complaint intake, evidence, analysis, routing, reports, audit, and messaging channels.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.database = database
    app.state.evidence_storage = build_evidence_storage(settings)
    app.state.complaint_analyzer = GeminiComplaintAnalyzer(settings)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "If-Match", "X-Complaint-Token", "X-Internal-API-Key", "X-Hub-Signature-256"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.get("/health", tags=["operations"])
    def health() -> dict:
        with database.session_factory() as db:
            db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "service": "niriksh-api",
            "version": "2.0.0",
            "database": "connected",
            "bhumika_integration": "configured" if settings.bhumika_integration_key else "disabled",
            "direct_whatsapp_webhook": "disabled",
            "connected_analysis": "configured" if settings.gemini_api_key else "fallback",
            "evidence_storage": settings.evidence_storage_backend,
        }

    app.include_router(api_router)
    return app


app = create_app()
