from __future__ import annotations

import logging
from typing import Dict, Iterable, Tuple

import pandas as pd

try:
    import talib
except ImportError:  # pragma: no cover - TA-Lib may be absent locally
    talib = None

logger = logging.getLogger(__name__)


class IndicatorCalculator:
    """Compute indicators required for strategy evaluation."""

    def calculate_all(self, candles: pd.DataFrame, requested: Iterable[Dict]) -> Dict[str, float]:
        if candles.empty:
            return {}

        results: Dict[str, float] = {
            "close": float(candles.iloc[-1]["close"]),
            "high": float(candles.iloc[-1]["high"]),
            "low": float(candles.iloc[-1]["low"]),
        }

        if talib is None:
            logger.debug("TA-Lib unavailable; indicator coverage limited")
            return results

        for condition in requested:
            raw_indicator = condition.get("indicator", "")
            base, period = self._parse_indicator_name(raw_indicator)
            indicator = raw_indicator.lower()

            if base == "ema" and period:
                results[indicator] = self.calculate_ema(candles, period)
            elif base == "sma" and period:
                results[indicator] = self.calculate_sma(candles, period)
            elif base == "rsi":
                results[indicator] = self.calculate_rsi(candles, period or 14)
            elif base == "macd":
                macd, signal, _ = talib.MACD(
                    candles["close"],
                    fastperiod=12,
                    slowperiod=26,
                    signalperiod=9,
                )
                results.setdefault("macd", float(macd.iloc[-1]))
                results.setdefault("macd_signal", float(signal.iloc[-1]))
            elif base == "cci":
                results[indicator] = float(
                    talib.CCI(candles["high"], candles["low"], candles["close"], timeperiod=period or 20).iloc[-1]
                )
            elif base == "atr":
                results[indicator] = self.calculate_atr(candles, period or 14)
            elif base in {"bb", "bbands"}:
                upper, middle, lower = talib.BBANDS(candles["close"], timeperiod=period or 20)
                results.setdefault("bb_upper", float(upper.iloc[-1]))
                results.setdefault("bb_middle", float(middle.iloc[-1]))
                results.setdefault("bb_lower", float(lower.iloc[-1]))
            elif base in {"stoch", "stochastic"}:
                slowk, slowd = talib.STOCH(
                    candles["high"], candles["low"], candles["close"],
                    fastk_period=14,
                    slowk_period=3,
                    slowk_matype=0,
                    slowd_period=3,
                    slowd_matype=0,
                )
                results.setdefault("stoch_k", float(slowk.iloc[-1]))
                results.setdefault("stoch_d", float(slowd.iloc[-1]))
            elif base == "adx":
                results[indicator] = float(
                    talib.ADX(candles["high"], candles["low"], candles["close"], timeperiod=period or 14).iloc[-1]
                )
            elif base in {"sar", "psar"}:
                sar = talib.SAR(candles["high"], candles["low"])
                results[indicator] = float(sar.iloc[-1])
            elif base == "obv":
                if "tick_volume" in candles:
                    volume_series = candles["tick_volume"]
                else:
                    volume_series = candles.get(
                        "volume",
                        pd.Series([0] * len(candles), index=candles.index),
                    )
                results[indicator] = float(talib.OBV(candles["close"], volume_series).iloc[-1])

        return results

    def calculate_ema(self, candles: pd.DataFrame, period: int) -> float:
        if talib is None:
            return float(candles["close"].ewm(span=period).mean().iloc[-1])
        return float(talib.EMA(candles["close"], timeperiod=period).iloc[-1])

    def calculate_sma(self, candles: pd.DataFrame, period: int) -> float:
        if talib is None:
            return float(candles["close"].rolling(period).mean().iloc[-1])
        return float(talib.SMA(candles["close"], timeperiod=period).iloc[-1])

    def calculate_rsi(self, candles: pd.DataFrame, period: int) -> float:
        if talib is None:
            delta = candles["close"].diff()
            up = delta.clip(lower=0).rolling(period).mean()
            down = -delta.clip(upper=0).rolling(period).mean()
            rs = up / down
            return float(100 - (100 / (1 + rs.iloc[-1])))
        return float(talib.RSI(candles["close"], timeperiod=period).iloc[-1])

    def calculate_atr(self, candles: pd.DataFrame, period: int) -> float:
        if talib is None:
            high_low = candles["high"] - candles["low"]
            high_close = (candles["high"] - candles["close"].shift()).abs()
            low_close = (candles["low"] - candles["close"].shift()).abs()
            tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
            return float(tr.rolling(period).mean().iloc[-1])
        return float(talib.ATR(candles["high"], candles["low"], candles["close"], timeperiod=period).iloc[-1])

    def _parse_indicator_name(self, name: str) -> Tuple[str, int | None]:
        lowered = name.lower()
        if "_" in lowered:
            base, maybe_period = lowered.split("_", 1)
            try:
                return base, int(maybe_period)
            except ValueError:
                return base, None
        return lowered, None


__all__ = ["IndicatorCalculator"]
