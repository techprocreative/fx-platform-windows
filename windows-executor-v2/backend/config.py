from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Application configuration derived from environment variables."""

    environment: str = Field(default="production")
    debug: bool = Field(default=False)
    api_host: str = Field(default="127.0.0.1")
    api_port: int = Field(default=8081)

    # MT5 Configuration
    mt5_terminal_path: Optional[str] = Field(default=None)

    # User Credentials (ONLY THESE ARE REQUIRED FROM USER)
    # Platform URL is HARDCODED and cannot be changed
    platform_api_url: str = "https://fx.nusanexus.com"
    api_key: Optional[str] = Field(default=None)  # User's API key
    api_secret: Optional[str] = Field(default=None)  # User's API secret
    executor_id: Optional[str] = Field(default=None)  # Unique executor ID

    # Pusher Credentials (AUTO-FETCHED from platform, not user input)
    pusher_app_id: Optional[str] = Field(default=None)
    pusher_key: Optional[str] = Field(default=None)
    pusher_secret: Optional[str] = Field(default=None)
    pusher_cluster: Optional[str] = Field(default=None)
    pusher_channel: Optional[str] = Field(default=None)

    # Internal Settings
    sqlite_path: str = Field(default="windows-executor-v2.sqlite3")
    heartbeat_interval_seconds: int = Field(default=30)


@lru_cache
def get_settings() -> Settings:
    """Return memoized settings instance."""
    
    # Load .env file if specified
    env_file = os.getenv("WE_V2_ENV_FILE")
    if env_file and os.path.exists(env_file):
        from dotenv import load_dotenv
        load_dotenv(env_file)
        print(f"✅ Loaded environment from: {env_file}")

    return Settings(
        environment=os.getenv("WE_V2_ENV", "production"),
        debug=os.getenv("WE_V2_DEBUG", "false").lower() == "true",
        api_host=os.getenv("WE_V2_API_HOST", "127.0.0.1"),
        api_port=int(os.getenv("WE_V2_API_PORT", "8081")),
        mt5_terminal_path=os.getenv("WE_V2_MT5_PATH"),
        # User credentials (platform_api_url is hardcoded, cannot be overridden)
        api_key=os.getenv("WE_V2_API_KEY"),
        api_secret=os.getenv("WE_V2_API_SECRET"),
        executor_id=os.getenv("WE_V2_EXECUTOR_ID"),
        # Pusher (auto-fetched from platform)
        pusher_app_id=os.getenv("WE_V2_PUSHER_APP_ID"),
        pusher_key=os.getenv("WE_V2_PUSHER_KEY"),
        pusher_secret=os.getenv("WE_V2_PUSHER_SECRET"),
        pusher_cluster=os.getenv("WE_V2_PUSHER_CLUSTER"),
        pusher_channel=os.getenv("WE_V2_PUSHER_CHANNEL"),
        # Internal
        sqlite_path=os.getenv("WE_V2_SQLITE_PATH", "windows-executor-v2.sqlite3"),
        heartbeat_interval_seconds=int(os.getenv("WE_V2_HEARTBEAT_INTERVAL", "30")),
    )


__all__ = ["Settings", "get_settings"]
