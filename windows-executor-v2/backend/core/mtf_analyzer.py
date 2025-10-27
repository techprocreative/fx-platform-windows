from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable

import pandas as pd

from ..indicators.talib_wrapper import IndicatorCalculator


@dataclass
class MultiTimeframeResult:
    confirmed: bool
    confidence: float
    signals: Dict[str, str]


class MultiTimeframeAnalyzer:
    """Gather confirmation from higher timeframes."""

    def __init__(self, mt5_client, indicator_calc: IndicatorCalculator) -> None:
        self.mt5_client = mt5_client
        self.indicator_calc = indicator_calc

    def analyse(self, symbol: str, primary_timeframe: str, config: Dict) -> MultiTimeframeResult:
        if not config.get("enabled", False):
            return MultiTimeframeResult(True, 100.0, {})

        higher_timeframes: Iterable[str] = config.get("higherTimeframes", []) or ["H4", "D1"]
        confirmation_required = bool(config.get("confirmationRequired", True))

        signals: Dict[str, str] = {}
        all_timeframes = [primary_timeframe] + list(higher_timeframes)

        for timeframe in all_timeframes:
            candles = self.mt5_client.get_candles(symbol, timeframe, count=150)
            if candles is None or candles.empty:
                signals[timeframe] = "neutral"
                continue
            signal = self._determine_trend(candles)
            signals[timeframe] = signal

        primary_signal = signals.get(primary_timeframe, "neutral")
        bullish = sum(1 for value in signals.values() if value == "bullish")
        bearish = sum(1 for value in signals.values() if value == "bearish")

        if primary_signal == "bullish":
            confirmed = bullish >= len(all_timeframes) if confirmation_required else bullish > bearish
            confidence = bullish / len(all_timeframes) * 100
        elif primary_signal == "bearish":
            confirmed = bearish >= len(all_timeframes) if confirmation_required else bearish > bullish
            confidence = bearish / len(all_timeframes) * 100
        else:
            confirmed = False
            confidence = 0

        return MultiTimeframeResult(confirmed, confidence, signals)

    def _determine_trend(self, candles: pd.DataFrame) -> str:
        indicators = self.indicator_calc.calculate_all(
            candles,
            [
                {"indicator": "ema_20"},
                {"indicator": "ema_50"},
                {"indicator": "rsi_14"},
            ],
        )
        ema20 = indicators.get("ema_20")
        ema50 = indicators.get("ema_50")
        rsi = indicators.get("rsi_14")

        if ema20 is None or ema50 is None or rsi is None:
            return "neutral"
        if ema20 > ema50 and rsi > 50:
            return "bullish"
        if ema20 < ema50 and rsi < 50:
            return "bearish"
        return "neutral"


__all__ = ["MultiTimeframeAnalyzer", "MultiTimeframeResult"]
