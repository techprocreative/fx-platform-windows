from __future__ import annotations

from fastapi import APIRouter, HTTPException

from core import mt5_client
from models import AccountInfo

router = APIRouter()


@router.get("/", response_model=AccountInfo, summary="MT5 account snapshot")
async def get_account():
    info = mt5_client.get_account_info()
    if not info:
        raise HTTPException(status_code=503, detail="MT5 is not connected")
    return AccountInfo.model_validate(info)
