from __future__ import annotations

from typing import Dict, Optional

import pandas as pd


class VolatilityFilter:
    """ATR-based volatility guard."""

    def __init__(self, mt5_client, indicator_calc) -> None:
        self.mt5_client = mt5_client
        self.indicator_calc = indicator_calc

    def check(self, symbol: str, config: Dict, candles: Optional[pd.DataFrame] = None) -> Dict:
        if not config.get("enabled", False):
            return {"passed": True, "atr": None, "action": "proceed"}

        candles = candles or self.mt5_client.get_candles(symbol, config.get("timeframe", "M15"), count=200)
        if candles is None or candles.empty:
            return {"passed": False, "atr": None, "action": "error", "reason": "candles_missing"}

        atr_value = self.indicator_calc.calculate_atr(candles, int(config.get("period", 14)))
        min_atr = float(config.get("minATR", 0))
        max_atr = float(config.get("maxATR", 9999))

        if atr_value < min_atr:
            action = config.get("action", {}).get("belowMin", "SKIP").upper()
            return {"passed": action != "SKIP", "atr": atr_value, "action": action.lower(), "reason": "atr_below_min"}

        if atr_value > max_atr:
            action = config.get("action", {}).get("aboveMax", "SKIP").upper()
            return {"passed": action != "SKIP", "atr": atr_value, "action": action.lower(), "reason": "atr_above_max"}

        optimal_action = config.get("action", {}).get("inOptimal", "NORMAL").lower()
        return {"passed": True, "atr": atr_value, "action": optimal_action or "normal"}


__all__ = ["VolatilityFilter"]
