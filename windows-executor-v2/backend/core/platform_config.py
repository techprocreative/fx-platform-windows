"""Fetch executor configuration from web platform."""

from __future__ import annotations

import logging
from typing import Dict, Optional

import httpx

from config import Settings, get_settings

logger = logging.getLogger(__name__)


class PlatformConfigService:
    """Service to fetch configuration from web platform API."""

    def __init__(self) -> None:
        self.settings = get_settings()

    async def fetch_executor_config(self) -> Optional[Dict]:
        """Fetch executor configuration from platform including Pusher credentials.
        
        Returns:
            Dict with keys:
            - pusher_key: Pusher application key
            - pusher_cluster: Pusher cluster (e.g., 'ap1')
            - pusher_channel: Channel name for this executor
            - pusher_app_id: Pusher application ID (optional)
            - pusher_secret: Pusher secret (optional, server-side only)
        """
        if not self.settings.api_key or not self.settings.platform_api_url:
            logger.warning("API key or platform URL not configured, cannot fetch config")
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.settings.platform_api_url}/api/executor/config",
                    headers={
                        "Authorization": f"Bearer {self.settings.api_key}",
                        "X-Executor-ID": self.settings.executor_id or "unknown",
                    },
                )
                response.raise_for_status()
                config = response.json()

                logger.info("✅ Successfully fetched configuration from platform")
                logger.debug(f"Pusher cluster: {config.get('pusher_cluster')}")
                logger.debug(f"Pusher channel: {config.get('pusher_channel')}")

                return config

        except httpx.HTTPStatusError as exc:
            logger.error(
                f"Failed to fetch config from platform: {exc.response.status_code} - {exc.response.text}"
            )
            return None
        except Exception as exc:
            logger.error(f"Error fetching config from platform: {exc}")
            return None

    def apply_config(self, config: Dict) -> None:
        """Apply fetched configuration to settings.
        
        Note: This updates the settings object but doesn't persist to .env file.
        Configuration will be re-fetched on next startup.
        """
        if not config:
            return

        # Update Pusher settings
        if "pusher_key" in config:
            self.settings.pusher_key = config["pusher_key"]
        if "pusher_cluster" in config:
            self.settings.pusher_cluster = config["pusher_cluster"]
        if "pusher_channel" in config:
            self.settings.pusher_channel = config["pusher_channel"]
        if "pusher_app_id" in config:
            self.settings.pusher_app_id = config["pusher_app_id"]
        if "pusher_secret" in config:
            self.settings.pusher_secret = config["pusher_secret"]

        logger.info("✅ Applied configuration from platform")

    async def fetch_and_apply(self) -> bool:
        """Fetch configuration from platform and apply it.
        
        Returns:
            True if successful, False otherwise
        """
        config = await self.fetch_executor_config()
        if config:
            self.apply_config(config)
            return True
        return False


__all__ = ["PlatformConfigService"]
