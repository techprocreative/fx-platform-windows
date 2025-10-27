from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional

import requests

logger = logging.getLogger(__name__)


class NewsFilter:
    """Gate trading activity around economic events."""

    def __init__(self) -> None:
        self._cache: List[Dict] = []
        self._cache_expiry: Optional[datetime] = None

    def check_news_blackout(self, symbol: str, config: Dict) -> bool:
        if not config.get("enabled", False):
            return False

        currencies = self._extract_currencies(symbol)
        if not currencies:
            return False

        pause_before = int(config.get("pauseBeforeMinutes", 30))
        pause_after = int(config.get("pauseAfterMinutes", 30))
        high_only = config.get("highImpactOnly", True)

        events = self._load_events(high_only)
        if not events:
            return False

        now = datetime.now(timezone.utc)
        blackout_window_start = now - timedelta(minutes=pause_before)
        blackout_window_end = now + timedelta(minutes=pause_after)

        for event in events:
            event_time_str = event.get("time") or event.get("timestamp")
            if not event_time_str:
                continue
            try:
                event_time = datetime.fromisoformat(event_time_str.replace("Z", "+00:00"))
            except ValueError:
                continue
            event_currency = event.get("currency")
            if event_currency and event_currency.upper() not in currencies:
                continue
            if blackout_window_start <= event_time <= blackout_window_end:
                logger.debug("News blackout active due to %s at %s", event.get("title"), event_time)
                return True

        return False

    def _load_events(self, high_only: bool) -> List[Dict]:
        now = datetime.now(timezone.utc)
        if self._cache_expiry and now < self._cache_expiry:
            return self._filtered_events(self._cache, high_only)

        try:
            response = requests.get(
                "https://economic-calendar.cryptohub.tech/events",
                params={
                    "from": now.isoformat(),
                    "to": (now + timedelta(days=3)).isoformat(),
                },
                timeout=5,
            )
            if response.status_code == 200:
                events = response.json()
                if isinstance(events, str):
                    events = json.loads(events)
                self._cache = events if isinstance(events, list) else []
            else:
                logger.debug("News API returned %s", response.status_code)
                self._cache = []
        except Exception as exc:  # pragma: no cover - network failures acceptable
            logger.debug("News API unavailable: %s", exc)
            self._cache = self._fallback_events(now)

        self._cache_expiry = now + timedelta(minutes=30)
        return self._filtered_events(self._cache, high_only)

    def _filtered_events(self, events: Iterable[Dict], high_only: bool) -> List[Dict]:
        if not high_only:
            return list(events)
        return [event for event in events if str(event.get("impact", "")).lower() in {"high", "red"}]

    def _fallback_events(self, now: datetime) -> List[Dict]:
        base = now.replace(hour=13, minute=30, second=0, microsecond=0)
        return [
            {
                "title": "Non-Farm Payrolls",
                "currency": "USD",
                "impact": "high",
                "time": (base + timedelta(days=1)).isoformat(),
            }
        ]

    def _extract_currencies(self, symbol: str) -> List[str]:
        symbol = symbol.upper().replace(".", "")
        if len(symbol) == 6:
            return [symbol[:3], symbol[3:]]
        if symbol.endswith("USD"):
            return [symbol[:-3], "USD"]
        return [symbol[:3]]


__all__ = ["NewsFilter"]
