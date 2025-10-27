from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

try:
    import talib
except ImportError:  # pragma: no cover - allow running without TA-Lib
    talib = None

logger = logging.getLogger(__name__)


@dataclass
class ExitLevels:
    stop_loss: float
    take_profit: float
    metadata: Dict[str, float]


class SmartExitManager:
    """Calculate exit targets using ATR, support/resistance, Fibonacci, and trailing logic."""

    def calculate_levels(
        self,
        direction: str,
        entry_price: float,
        exit_config: Dict,
        candles: pd.DataFrame,
        symbol_info: Dict,
    ) -> ExitLevels:
        stop_loss = self._calculate_stop_loss(direction, entry_price, exit_config, candles, symbol_info)
        take_profit = self._calculate_take_profit(direction, entry_price, exit_config, stop_loss, symbol_info)
        return ExitLevels(stop_loss=stop_loss, take_profit=take_profit, metadata={})

    def update_trailing_stop(
        self,
        position: Dict,
        current_price: float,
        trail_config: Dict,
        symbol_info: Dict,
    ) -> Optional[float]:
        trail_distance = float(trail_config.get("distance", 30)) * symbol_info.get("point", 0.0001) * 10
        trail_step = float(trail_config.get("step", 10)) * symbol_info.get("point", 0.0001) * 10

        if position["type"] == "BUY":
            new_stop = current_price - trail_distance
            if new_stop > position.get("stopLoss", 0) + trail_step:
                return new_stop
        else:
            new_stop = current_price + trail_distance
            if new_stop < position.get("stopLoss", 0) - trail_step:
                return new_stop
        return None

    def _calculate_stop_loss(
        self,
        direction: str,
        entry_price: float,
        exit_config: Dict,
        candles: pd.DataFrame,
        symbol_info: Dict,
    ) -> float:
        config = exit_config.get("smartExit", {}).get("stopLoss", exit_config.get("stopLoss", {}))
        stop_type = config.get("type", "fixed").lower()
        point = symbol_info.get("point", 0.0001)

        if stop_type == "atr" and talib is not None:
            period = int(config.get("period", 14))
            multiplier = float(config.get("atrMultiplier", 2.0))
            atr = talib.ATR(candles["high"], candles["low"], candles["close"], timeperiod=period)
            distance = float(atr.iloc[-1]) * multiplier
        elif stop_type == "support":
            levels = self._find_support_resistance(candles)
            supports = [level for level in levels["support"] if level < entry_price]
            distance = entry_price - (max(supports) if supports else entry_price - 50 * point)
        elif stop_type == "trailing":
            distance = float(config.get("trailDistance", 30)) * point * 10
        else:
            distance = float(config.get("value", 25)) * point * 10

        stop_price = entry_price - distance if direction == "BUY" else entry_price + distance
        digits = symbol_info.get("digits", 5)
        return round(stop_price, digits)

    def _calculate_take_profit(
        self,
        direction: str,
        entry_price: float,
        exit_config: Dict,
        stop_loss: float,
        symbol_info: Dict,
    ) -> float:
        config = exit_config.get("smartExit", {}).get("takeProfit", exit_config.get("takeProfit", {}))
        tp_type = config.get("type", "pips").lower()
        point = symbol_info.get("point", 0.0001)
        digits = symbol_info.get("digits", 5)

        if tp_type == "rr_ratio":
            rr = float(config.get("rrRatio", 2.0))
            risk = abs(entry_price - stop_loss)
            distance = risk * rr
        elif tp_type == "fibonacci" and talib is not None:
            high = float(candles["high"].iloc[-1])
            low = float(candles["low"].iloc[-1])
            fib_levels = self._calculate_fibonacci_targets(high, low, direction)
            distance = abs(fib_levels[0] - entry_price)
        elif tp_type == "pips":
            distance = float(config.get("value", 40)) * point * 10
        else:
            distance = float(config.get("value", 40)) * point * 10

        if direction == "BUY":
            tp_price = entry_price + distance
        else:
            tp_price = entry_price - distance
        return round(tp_price, digits)

    def _find_support_resistance(self, candles: pd.DataFrame, lookback: int = 50) -> Dict[str, List[float]]:
        supports: List[float] = []
        resistances: List[float] = []

        highs = candles["high"].rolling(window=lookback).max()
        lows = candles["low"].rolling(window=lookback).min()
        supports.append(float(lows.iloc[-1]))
        resistances.append(float(highs.iloc[-1]))

        if talib is not None:
            pivot = (candles["high"] + candles["low"] + candles["close"]) / 3
            r1 = 2 * pivot - candles["low"]
            s1 = 2 * pivot - candles["high"]
            resistances.append(float(r1.iloc[-1]))
            supports.append(float(s1.iloc[-1]))

        return {
            "support": sorted(set(supports)),
            "resistance": sorted(set(resistances)),
        }

    def _calculate_fibonacci_targets(self, swing_high: float, swing_low: float, direction: str) -> List[float]:
        diff = swing_high - swing_low
        if direction == "BUY":
            return [
                swing_high + diff * level
                for level in (0.236, 0.382, 0.5, 0.618, 1.0, 1.618)
            ]
        return [
            swing_low - diff * level
            for level in (0.236, 0.382, 0.5, 0.618, 1.0, 1.618)
        ]


__all__ = ["SmartExitManager", "ExitLevels"]
