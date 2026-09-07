from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = BACKEND_ROOT.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPOSITORY_ROOT / ".env", BACKEND_ROOT / ".env"),
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    app_name: str = "Niriksh API"
    app_env: str = "development"
    database_url: str = "sqlite:///./data/niriksh.db"
    frontend_origins: str = "http://localhost:3000"
    jwt_secret: str = "local-only-change-before-deployment"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    internal_api_key: str = "local-development-key"
    directory_hash_secret: str = ""
    bhumika_integration_key: str = ""
    public_app_url: str = "http://localhost:3000"
    tracking_token_days: int = 180
    seed_demo_users: bool = True
    demo_user_password: str = "demo-only-change-me"
    evidence_storage_path: Path = Path("./data/evidence")
    evidence_storage_backend: str = "local"
    evidence_s3_bucket: str = ""
    evidence_s3_region: str = "ap-south-1"
    evidence_s3_prefix: str = "niriksh/evidence"
    evidence_s3_endpoint_url: str = ""
    evidence_s3_access_key_id: str = ""
    evidence_s3_secret_access_key: str = ""
    evidence_s3_force_path_style: bool = False
    max_evidence_bytes: int = 10_000_000
    auto_create_tables: bool = True
    process_webhooks_inline: bool = True
    worker_poll_seconds: float = 2.0

    whatsapp_verify_token: str = Field(default="replace-me", validation_alias=AliasChoices("WHATSAPP_VERIFY_TOKEN", "VERIFY_TOKEN"))
    whatsapp_app_secret: str = ""
    whatsapp_access_token: str = Field(default="", validation_alias=AliasChoices("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_TOKEN"))
    whatsapp_phone_number_id: str = Field(default="", validation_alias=AliasChoices("WHATSAPP_PHONE_NUMBER_ID", "PHONE_NUMBER_ID"))
    whatsapp_graph_version: str = Field(default="v21.0", validation_alias=AliasChoices("WHATSAPP_GRAPH_VERSION", "GRAPH_API_VERSION"))

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    gemini_fallback_model: str = "gemini-3.6-flash"
    gemini_reserve_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: float = 25.0

    fal_key: str = ""
    fal_h3_model: str = "minimax/h3-max-turbo/text-to-video"
    fal_h3_reference_model: str = "minimax/h3-max/reference-to-video"

    # PSA publish connectors (plan-awareness-psa.md, Phase 3). Each is inert until its
    # credentials are set -- publish_to_configured_channels skips any that aren't.
    youtube_client_id: str = ""
    youtube_client_secret: str = ""
    youtube_refresh_token: str = ""
    youtube_category_id: str = "27"
    youtube_privacy_status: str = "unlisted"

    instagram_access_token: str = ""
    instagram_business_account_id: str = ""

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        if "://postgresql://" in value or "://postgres://" in value:
            raise ValueError("DATABASE_URL contains two URI schemes")
        if value.startswith(("postgresql://", "postgres://")):
            value = value.replace("postgres://", "postgresql://", 1)
            value = value.replace("postgresql://", "postgresql+psycopg://", 1)
        if ".pooler.supabase.com" in value and "sslmode=" not in value:
            value += ("&" if "?" in value else "?") + "sslmode=require"
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [part.strip() for part in self.frontend_origins.split(",") if part.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
