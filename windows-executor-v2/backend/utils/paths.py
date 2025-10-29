from __future__ import annotations

from pathlib import Path
import os


APP_SUBDIR = "FXExecutorV2"


def get_appdata_dir() -> Path:
    """Return the base directory for executor data under AppData."""
    base = os.getenv('APPDATA') or os.getenv('LOCALAPPDATA')
    if not base:
        base = Path.home() / 'AppData' / 'Roaming'
    else:
        base = Path(base)
    target = base / APP_SUBDIR
    target.mkdir(parents=True, exist_ok=True)
    return target


def get_logs_dir() -> Path:
    logs = get_appdata_dir() / 'logs'
    logs.mkdir(parents=True, exist_ok=True)
    return logs


def get_config_path() -> Path:
    cfg_dir = get_appdata_dir()
    cfg_dir.mkdir(parents=True, exist_ok=True)
    return cfg_dir / 'config.json'
