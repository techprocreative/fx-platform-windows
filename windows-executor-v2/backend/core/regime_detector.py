from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

import pandas as pd

try:
    import talib
except ImportError:  # pragma: no cover - degrade gracefully
    talib = None


@dataclass
class RegimeResult:
    regime: str
    confidence: float
    metadata: Dict[str, float]


class MarketRegimeDetector:
    """Identify current market regime using ADX, ATR and moving averages."""

    def detect_regime(self, candles: pd.DataFrame) -> RegimeResult:
        if candles.empty or talib is None:
            return RegimeResult("unknown", 0, {})

        adx = talib.ADX(candles["high"], candles["low"], candles["close"], timeperiod=14)
        atr = talib.ATR(candles["high"], candles["low"], candles["close"], timeperiod=14)
        sma20 = talib.SMA(candles["close"], timeperiod=20)
        sma50 = talib.SMA(candles["close"], timeperiod=50)

        current_price = float(candles["close"].iloc[-1])
        current_adx = float(adx.iloc[-1])
        atr_series = atr.dropna()
        atr_percentile = float((atr_series.rank(pct=True).iloc[-1] * 100)) if not atr_series.empty else 0

        regime = "ranging"
        confidence = 50
        if current_adx > 25:
            if sma20.iloc[-1] > sma50.iloc[-1] and current_price > sma20.iloc[-1]:
                regime = "trending_up"
            elif sma20.iloc[-1] < sma50.iloc[-1] and current_price < sma20.iloc[-1]:
                regime = "trending_down"
            confidence = min(current_adx / 50 * 100, 100)
        elif atr_percentile > 70:
            regime = "volatile"
            confidence = atr_percentile

        metadata = {
            "adx": current_adx,
            "atr": float(atr.iloc[-1]),
            "atr_percentile": atr_percentile,
        }
        return RegimeResult(regime, confidence, metadata)

    def adjust_strategy(self, regime: str, rules: Dict) -> Dict:
        adjusted = dict(rules)
        if regime in {"trending_up", "trending_down"}:
            adjusted.setdefault("positionSizeMultiplier", 1.2)
            adjusted.setdefault("stopLossMultiplier", 1.5)
            adjusted.setdefault("takeProfitMultiplier", 2.0)
        elif regime == "ranging":
            adjusted.setdefault("positionSizeMultiplier", 0.8)
            adjusted.setdefault("stopLossMultiplier", 0.8)
            adjusted.setdefault("takeProfitMultiplier", 1.2)
        elif regime == "volatile":
            adjusted.setdefault("positionSizeMultiplier", 0.5)
            adjusted.setdefault("stopLossMultiplier", 2.0)
            adjusted.setdefault("takeProfitMultiplier", 3.0)
        return adjusted


__all__ = ["MarketRegimeDetector", "RegimeResult"]
