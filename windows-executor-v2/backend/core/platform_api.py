"""Web Platform API client for reporting back."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

from config import get_settings
from utils.retry import async_retry

logger = logging.getLogger(__name__)


class WebPlatformAPI:
    """Client for communicating with web platform backend."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = self.settings.platform_api_url
        self.executor_id = self.settings.executor_id
        self.api_key = self.settings.api_key
        self.api_secret = self.settings.api_secret

    @async_retry(max_attempts=3, initial_delay=1.0, exceptions=(httpx.HTTPError,))
    async def report_trade(self, trade_data: Dict[str, Any]) -> bool:
        """Report executed trade back to platform."""
        if not self.base_url or not self.api_key:
            logger.warning("Platform API not configured, skipping trade report")
            return False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/executor/trades",
                    json={
                        "executorId": self.executor_id,
                        "strategyId": trade_data.get("strategyId"),
                        "ticket": trade_data.get("ticket"),
                        "symbol": trade_data.get("symbol"),
                        "type": trade_data.get("type"),
                        "lots": trade_data.get("lots"),
                        "openPrice": trade_data.get("openPrice"),
                        "stopLoss": trade_data.get("stopLoss"),
                        "takeProfit": trade_data.get("takeProfit"),
                        "openTime": trade_data.get("openTime"),
                    },
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                response.raise_for_status()
                logger.info("Trade reported to platform: ticket=%s", trade_data.get("ticket"))
                return True
        except Exception as exc:
            logger.error("Failed to report trade to platform: %s", exc)
            return False

    @async_retry(max_attempts=2, initial_delay=1.0, exceptions=(httpx.HTTPError,))
    async def send_heartbeat(self, status: Dict[str, Any]) -> bool:
        """Send heartbeat with executor status."""
        if not self.base_url or not self.api_key:
            return False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/executor/heartbeat",
                    json={
                        "executorId": self.executor_id,
                        "status": status.get("status", "active"),
                        "activeStrategies": status.get("activeStrategies", 0),
                        "openPositions": status.get("openPositions", 0),
                        "timestamp": status.get("timestamp"),
                    },
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                response.raise_for_status()
                return True
        except Exception as exc:
            logger.debug("Heartbeat failed: %s", exc)
            return False

    async def report_trade_close(
        self,
        ticket: int,
        close_price: float,
        profit: float,
        close_time: str,
    ) -> bool:
        """Report trade closure to platform."""
        if not self.base_url or not self.api_key:
            return False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/executor/trades/{ticket}/close",
                    json={
                        "executorId": self.executor_id,
                        "closePrice": close_price,
                        "profit": profit,
                        "closeTime": close_time,
                    },
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                response.raise_for_status()
                logger.info("Trade close reported: ticket=%s profit=%.2f", ticket, profit)
                return True
        except Exception as exc:
            logger.error("Failed to report trade close: %s", exc)
            return False

    async def fetch_user_strategies(self) -> list[Dict[str, Any]]:
        """Fetch user's strategies from platform."""
        if not self.base_url or not self.api_key:
            logger.warning("Platform API not configured, returning empty strategies")
            return []

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/strategies",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "X-API-Secret": self.api_secret or "",
                    },
                )
                response.raise_for_status()
                strategies = response.json()
                logger.info("Fetched %d strategies from platform", len(strategies))
                return strategies
        except Exception as exc:
            logger.error("Failed to fetch strategies from platform: %s", exc)
            return []
    
    async def fetch_active_strategies(self) -> list[Dict[str, Any]]:
        """Fetch active strategies assigned to this executor."""
        if not self.base_url or not self.api_key or not self.executor_id:
            logger.warning("Platform API not configured, returning empty strategies")
            return []

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Fetch strategies assigned to this specific executor
                response = await client.get(
                    f"{self.base_url}/api/executor/{self.executor_id}/active-strategies",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "X-API-Secret": self.api_secret or "",
                    },
                )
                response.raise_for_status()
                data = response.json()
                strategies = data.get("strategies", [])
                logger.info("Fetched %d active strategies assigned to executor %s", 
                           len(strategies), self.executor_id)
                return strategies
        except Exception as exc:
            logger.error("Failed to fetch active strategies from platform: %s", exc)
            return []

    async def fetch_strategy_by_id(self, strategy_id: str) -> Optional[Dict[str, Any]]:
        """Fetch specific strategy from platform."""
        if not self.base_url or not self.api_key:
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/strategies/{strategy_id}",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "X-API-Secret": self.api_secret or "",
                    },
                )
                response.raise_for_status()
                return response.json()
        except Exception as exc:
            logger.error("Failed to fetch strategy %s: %s", strategy_id, exc)
            return None
