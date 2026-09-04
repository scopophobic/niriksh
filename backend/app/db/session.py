from dataclasses import dataclass

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker


@dataclass
class Database:
    engine: object
    session_factory: sessionmaker[Session]


def build_database(url: str) -> Database:
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    engine = create_engine(url, pool_pre_ping=True, connect_args=connect_args)
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def enable_foreign_keys(connection, _):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    return Database(engine=engine, session_factory=sessionmaker(bind=engine, expire_on_commit=False))

