from __future__ import annotations

from datetime import datetime, time, timezone
from typing import Dict, Iterable


class SessionFilter:
    """Filter trades based on trading session windows."""

    SESSION_WINDOWS: Dict[str, tuple[time, time]] = {
        "london": (time(7, 0), time(16, 0)),
        "newyork": (time(12, 0), time(21, 0)),
        "tokyo": (time(23, 0), time(8, 0)),
        "sydney": (time(21, 0), time(6, 0)),
    }

    OPTIMAL_PAIRS: Dict[str, tuple[str, ...]] = {
        "london": ("EURUSD", "GBPUSD", "EURGBP", "XAUUSD"),
        "newyork": ("EURUSD", "USDJPY", "USDCAD", "XAUUSD"),
        "tokyo": ("USDJPY", "AUDJPY", "NZDJPY"),
        "sydney": ("AUDUSD", "NZDUSD", "AUDJPY"),
    }

    def check(self, symbol: str, config: Dict) -> bool:
        if not config.get("enabled", False):
            return True

        allowed_sessions: Iterable[str] = config.get("allowedSessions", [])
        if not allowed_sessions:
            return True

        now = datetime.now(timezone.utc).time()
        use_optimal_pairs = config.get("useOptimalPairs", False)
        symbol_upper = symbol.upper()

        for session in allowed_sessions:
            session_key = session.lower()
            window = self.SESSION_WINDOWS.get(session_key)
            if not window:
                continue
            if use_optimal_pairs:
                optimal_pairs = self.OPTIMAL_PAIRS.get(session_key)
                if optimal_pairs and symbol_upper not in optimal_pairs:
                    continue
            start, end = window
            if start <= end:
                if start <= now <= end:
                    return True
            else:
                if now >= start or now <= end:
                    return True

        return False


__all__ = ["SessionFilter"]
