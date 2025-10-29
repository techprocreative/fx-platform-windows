from typing import Optional, Callable
import asyncio
import httpx


class PusherClient:
    def __init__(self) -> None:
        self._connected = False
        self._channel_name: Optional[str] = None

    async def connect(
        self,
        app_key: str,
        cluster: str,
        api_key: str,
        api_secret: str,
        executor_id: str,
        platform_url: str,
    ) -> None:
        """Minimal skeleton for private channel auth. Real WS is handled by pysher.
        Here we only validate auth endpoint works.
        """
        auth_url = f"{platform_url}/api/pusher/auth"

        # Pusher client must first get a socket_id from Pusher; in skeleton we just hit auth endpoint
        # with a fake socket id to validate credentials flow during integration tests.
        form = {
            "socket_id": "FAKE.SOCKET.ID",
            "channel_name": f"private-executor-{executor_id}",
        }
        headers = {"X-API-Key": api_key, "X-API-Secret": api_secret}
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(auth_url, data=form, headers=headers)
            if r.status_code != 200:
                raise RuntimeError(f"Pusher auth failed: {r.status_code} {r.text}")

        # Mark as connected for skeleton purposes
        self._channel_name = form["channel_name"]
        self._connected = True

    @property
    def connected(self) -> bool:
        return self._connected

