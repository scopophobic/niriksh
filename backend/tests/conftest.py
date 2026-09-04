from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.db.session import build_database
from app.main import create_app


@pytest.fixture
def client(tmp_path: Path):
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        evidence_storage_path=tmp_path / "evidence",
        internal_api_key="test-internal-key",
        bhumika_integration_key="test-bhumika-key",
        jwt_secret="test-secret-that-is-long-enough-for-the-suite",
        whatsapp_verify_token="verify-test",
        demo_user_password="test-password",
        gemini_api_key="",
    )
    database = build_database(settings.database_url)
    app = create_app(settings=settings, database=database)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def internal_headers():
    return {"X-Internal-API-Key": "test-internal-key"}
