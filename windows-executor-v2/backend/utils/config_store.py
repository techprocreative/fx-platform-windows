from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Optional
import keyring

from .paths import get_config_path


SERVICE_NAME = "fx-executor-v2"


def load_config() -> Dict[str, Any]:
    path = get_config_path()
    if not path.exists():
        return {}
    try:
        with path.open('r', encoding='utf-8') as fh:
            data = json.load(fh)
        return data
    except Exception:
        return {}


def save_config(data: Dict[str, Any], api_secret: Optional[str] = None) -> None:
    path = get_config_path()
    payload = dict(data)
    if 'apiSecret' in payload:
        payload.pop('apiSecret')
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as fh:
        json.dump(payload, fh, indent=2)

    if api_secret is not None and data.get('executorId'):
        keyring.set_password(SERVICE_NAME, data['executorId'], api_secret)


def get_stored_secret(executor_id: str) -> Optional[str]:
    try:
        return keyring.get_password(SERVICE_NAME, executor_id)
    except Exception:
        return None
