from __future__ import annotations

from typing import Dict


class SpreadFilter:
    """Validate spreads before placing orders."""

    def __init__(self, mt5_client) -> None:
        self.mt5_client = mt5_client

    def check(self, symbol: str, config: Dict) -> Dict:
        if not config.get("enabled", False):
            return {"passed": True, "spread": None, "action": "proceed"}

        info = self.mt5_client.get_symbol_info(symbol)
        if not info:
            return {"passed": False, "spread": None, "action": "error", "reason": "symbol_info_missing"}

        spread = info.get("spread") or 0
        max_spread = float(config.get("maxSpread", 3))
        action = str(config.get("action", "SKIP")).upper()

        if spread <= max_spread:
            return {"passed": True, "spread": spread, "action": "proceed"}

        if action == "REDUCE_SIZE":
            factor = float(config.get("reduceFactor", 0.5))
            return {
                "passed": True,
                "spread": spread,
                "action": "reduce",
                "factor": max(0.1, min(factor, 1.0)),
            }

        return {
            "passed": False,
            "spread": spread,
            "action": "skip",
            "reason": "spread_above_threshold",
        }


__all__ = ["SpreadFilter"]
