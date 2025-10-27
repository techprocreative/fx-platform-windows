from __future__ import annotations

import logging
import logging.config
from pathlib import Path
from typing import Any, Dict

try:
    from python_json_logger import jsonlogger
except ImportError:  # pragma: no cover - optional dependency
    jsonlogger = None


LOG_LEVEL = "INFO"


def configure_logging(level: str = LOG_LEVEL) -> None:
    """Configure structured logging for the backend."""

    logging_config: Dict[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": jsonlogger.JsonFormatter if jsonlogger else logging.Formatter,
                "fmt": "%(asctime)s %(name)s %(levelname)s %(message)s",
            },
            "plain": {
                "()": logging.Formatter,
                "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "plain",
                "level": level,
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "formatter": "json" if jsonlogger else "plain",
                "level": level,
                "filename": str(_log_path()),
                "maxBytes": 5 * 1024 * 1024,
                "backupCount": 3,
            },
        },
        "root": {
            "handlers": ["console", "file"],
            "level": level,
        },
    }

    logging.config.dictConfig(logging_config)


def _log_path() -> Path:
    base_dir = Path(__file__).resolve().parents[3]
    logs_dir = base_dir / "windows-executor-v2" / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    return logs_dir / "backend.log"


__all__ = ["configure_logging"]
