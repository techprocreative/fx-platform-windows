from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable, Optional

try:
    import pysher
except ImportError:  # pragma: no cover - optional dependency during local dev
    pysher = None

logger = logging.getLogger(__name__)


class PusherCommandClient:
    """Wrapper around Pusher channel subscriptions."""

    def __init__(self) -> None:
        self._client: Optional[Any] = None
        self._channel_name: Optional[str] = None
        self._queue: Optional[asyncio.Queue] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def connect(self, key: str, cluster: str, channel_name: str) -> None:
        if pysher is None:
            logger.warning("pysher dependency not installed; skipping Pusher connection")
            return

        self._client = pysher.Pusher(key, cluster=cluster)
        self._channel_name = channel_name
        self._client.connection.bind("pusher:connection_established", self._on_connect)
        self._client.connect()

    def register_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def attach_queue(self, queue: asyncio.Queue) -> None:
        self._queue = queue

    def subscribe(self, event: str, handler: Callable[[Any], None] | None) -> None:
        if self._client is None or self._channel_name is None:
            logger.debug("Pusher client not connected; subscription skipped")
            return

        channel = self._client.subscribe(self._channel_name)
        channel.bind(event, lambda payload: self._handle_event(payload, handler))

    def disconnect(self) -> None:
        if self._client:
            self._client.disconnect()
            logger.info("Pusher client disconnected")
        self._client = None
        self._channel_name = None

    def emit_local(self, payload: dict) -> None:
        if self._queue and self._loop:
            self._loop.call_soon_threadsafe(self._queue.put_nowait, payload)

    def _on_connect(self, data: Any) -> None:
        logger.info("Connected to Pusher: %s", data)

    def _handle_event(self, payload: Any, handler: Callable[[Any], None] | None) -> None:
        if handler:
            handler(payload)

        if not self._queue or not self._loop:
            return

        try:
            parsed = json.loads(payload) if isinstance(payload, str) else payload
        except json.JSONDecodeError:
            logger.debug("Failed to decode event payload: %s", payload)
            return

        self._loop.call_soon_threadsafe(self._queue.put_nowait, parsed)


__all__ = ["PusherCommandClient"]
