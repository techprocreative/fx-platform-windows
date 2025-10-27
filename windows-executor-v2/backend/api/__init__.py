from __future__ import annotations

from fastapi import APIRouter

from api import account, health, strategies, system, trades

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(account.router, prefix="/account", tags=["account"])
api_router.include_router(strategies.router, prefix="/strategies", tags=["strategies"])
api_router.include_router(trades.router, prefix="/trades", tags=["trades"])

__all__ = ["api_router"]
