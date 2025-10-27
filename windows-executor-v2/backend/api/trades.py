from __future__ import annotations

from typing import List

from fastapi import APIRouter

from core import mt5_client


router = APIRouter()


@router.get("/open", summary="Open MT5 positions")
async def open_positions() -> List[dict]:
    return mt5_client.get_positions()
