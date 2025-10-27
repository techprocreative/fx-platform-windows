from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List

import pandas as pd


@dataclass
class CorrelationResult:
    passed: bool
    action: str
    correlations: Dict[str, float]
    reason: str | None = None
    factor: float | None = None
    hedge_symbols: List[str] | None = None


class CorrelationFilter:
    """Check inter-market correlation before executing additional trades."""

    def __init__(self, mt5_client) -> None:
        self.mt5_client = mt5_client

    def check_correlation(self, primary_symbol: str, config: Dict) -> CorrelationResult:
        if not config.get("enabled", False):
            return CorrelationResult(True, "proceed", {})

        symbols: Iterable[str] = config.get("symbols", [])
        threshold = float(config.get("threshold", 0.7))
        action = str(config.get("action", "skip")).lower()

        correlations: Dict[str, float] = {}
        primary_data = self._load_returns(primary_symbol, config)
        if primary_data is None:
            return CorrelationResult(False, "error", {}, reason="missing_primary_data")

        for symbol in symbols:
            if symbol.upper() == primary_symbol.upper():
                continue
            comp_returns = self._load_returns(symbol, config)
            if comp_returns is None:
                continue
            correlations[symbol] = float(primary_data.corr(comp_returns))

        high_corr = [s for s, value in correlations.items() if abs(value) >= threshold]
        if not high_corr:
            return CorrelationResult(True, "proceed", correlations)

        if action == "reduce":
            factor = float(config.get("reduceFactor", 0.5))
            return CorrelationResult(True, "reduce", correlations, factor=max(0.1, min(factor, 1.0)))

        if action == "hedge":
            return CorrelationResult(True, "hedge", correlations, hedge_symbols=high_corr)

        return CorrelationResult(False, "skip", correlations, reason="high_correlation")

    def _load_returns(self, symbol: str, config: Dict) -> pd.Series | None:
        timeframe = config.get("timeframe", "H1")
        count = int(config.get("lookback", 200))
        candles = self.mt5_client.get_candles(symbol, timeframe, count=count)
        if candles is None or candles.empty:
            return None
        closes = candles["close"].pct_change().dropna()
        if closes.empty:
            return None
        return closes


__all__ = ["CorrelationFilter", "CorrelationResult"]
