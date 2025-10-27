from __future__ import annotations

import platform
from datetime import datetime

from fastapi import APIRouter

from config import get_settings


router = APIRouter()


@router.get("/info", summary="System information")
async def system_info():
    settings = get_settings()
    return {
        "environment": settings.environment,
        "debug": settings.debug,
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "timestamp": datetime.utcnow(),
    }
