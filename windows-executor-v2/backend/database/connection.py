from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import get_settings


class Base(DeclarativeBase):
    pass


def get_engine():
    settings = get_settings()
    db_path = Path(settings.sqlite_path)
    if not db_path.is_absolute():
        base_dir = Path(__file__).resolve().parents[3]
        db_path = base_dir / "windows-executor-v2" / db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)

    url = f"sqlite+pysqlite:///{db_path.as_posix()}"
    return create_engine(url, echo=settings.debug, future=True)


engine = get_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


__all__ = ["Base", "engine", "SessionLocal", "session_scope", "get_engine"]
