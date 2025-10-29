from __future__ import annotations

from typing import Dict, Any, Optional
import time
import httpx


class TTLCache:
    def __init__(self) -> None:
        self._store: Dict[str, Any] = {}

    def get(self, key: str) -> Optional[Any]:
        v = self._store.get(key)
        if not v:
            return None
        if time.time() > v["expires_at"]:
            self._store.pop(key, None)
            return None
        return v["value"]

    def set(self, key: str, value: Any, ttl_ms: int) -> None:
        self._store[key] = {"value": value, "expires_at": time.time() + ttl_ms / 1000.0}


class SupervisorClient:
    def __init__(self, platform_url: str, api_key: str, api_secret: str, executor_id: str) -> None:
        self.platform_url = platform_url.rstrip("/")
        self.api_key = api_key
        self.api_secret = api_secret
        self.executor_id = executor_id
        self.cache = TTLCache()

    def _cache_key(self, context: Dict[str, Any]) -> str:
        # Stable minimal key from selected fields
        parts = [
            str(context.get("symbol")),
            str(context.get("timeframe")),
            str(context.get("proposed_action")),
            str(context.get("risk", {}).get("sl_pips")),
            str(context.get("risk", {}).get("tp_pips")),
            str(context.get("filters", {}).get("spread")),
            str(context.get("ml", {}).get("signal_score")),
        ]
        return "|".join(parts)

    async def evaluate(self, context: Dict[str, Any], timeout_s: float = 6.0) -> Dict[str, Any]:
        key = self._cache_key(context)
        cached = self.cache.get(key)
        if cached:
            return {**cached, "cached": True}

        url = f"{self.platform_url}/api/executor/{self.executor_id}/supervisor/evaluate"
        headers = {"X-API-Key": self.api_key, "X-API-Secret": self.api_secret}
        payload = {"context": context, "timeoutMs": int(timeout_s * 1000)}

        async with httpx.AsyncClient(timeout=timeout_s) as client:
            r = await client.post(url, headers=headers, json=payload)
            if r.status_code != 200:
                # Fail-open behavior: allow with advisory
                return {
                    "action": "allow",
                    "reason": f"supervisor {r.status_code}",
                    "risks": ["supervisor_unavailable"],
                    "suggestions": ["Proceed cautiously"],
                    "mode": "observe",
                }
            data = r.json()
            ttl_ms = int(data.get("ttlMs", 0))
            if ttl_ms > 0:
                self.cache.set(key, data, ttl_ms)
            return data

