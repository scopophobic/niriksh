import logging
import signal
import time
from datetime import datetime, timezone

from sqlalchemy import or_, select

from app.core.config import get_settings
from app.db.base import Base
from app.db.models import WebhookEvent
from app.db.session import build_database
from app.modules.whatsapp.service import process_webhook_event
from app.modules.analysis.provider import GeminiComplaintAnalyzer
from app.storage import build_evidence_storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("niriksh.worker")
running = True


def stop(*_) -> None:
    global running
    running = False


def main() -> None:
    settings = get_settings()
    database = build_database(settings.database_url)
    if settings.auto_create_tables:
        Base.metadata.create_all(database.engine)
    app_context = type("WorkerApp", (), {})()
    app_context.state = type("State", (), {
        "settings": settings,
        "database": database,
        "evidence_storage": build_evidence_storage(settings),
        "complaint_analyzer": GeminiComplaintAnalyzer(settings),
    })()
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    logger.info("Niriksh worker started")
    while running:
        now = datetime.now(timezone.utc)
        with database.session_factory() as db:
            event_id = db.scalar(
                select(WebhookEvent.id)
                .where(
                    WebhookEvent.attempt_count < 5,
                    WebhookEvent.next_attempt_at <= now,
                    or_(WebhookEvent.status == "received", WebhookEvent.status == "failed"),
                )
                .order_by(WebhookEvent.received_at.asc())
                .limit(1)
            )
        if event_id:
            try:
                process_webhook_event(app_context, event_id)
            except Exception:
                logger.exception("Webhook event %s failed", event_id)
            continue
        time.sleep(settings.worker_poll_seconds)
    database.engine.dispose()
    logger.info("Niriksh worker stopped")


if __name__ == "__main__":
    main()
