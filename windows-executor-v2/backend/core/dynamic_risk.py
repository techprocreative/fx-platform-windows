from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

import numpy as np


@dataclass
class TradeRecord:
    profit: float


class DynamicRiskManager:
    """Advanced sizing logic supporting multiple adaptive methodologies."""

    def __init__(self) -> None:
        self.trade_history: List[TradeRecord] = []

    def register_trade(self, profit: float) -> None:
        self.trade_history.append(TradeRecord(profit=profit))
        if len(self.trade_history) > 500:
            self.trade_history.pop(0)

    def calculate_position_size(self, account_info: Dict, config: Dict, market: Dict) -> float:
        method = config.get("method", "fixed")

        if method == "kelly_criterion":
            return self._kelly(account_info, config)
        if method == "atr_based":
            return self._atr_based(account_info, config, market)
        if method == "volatility_based":
            return self._volatility_based(account_info, config, market)
        if method == "account_equity":
            return self._equity_based(account_info, config)

        return float(config.get("lotSize", 0.01))

    def _kelly(self, account_info: Dict, config: Dict) -> float:
        if len(self.trade_history) < 20:
            return float(config.get("minLotSize", 0.01))

        profits = np.array([trade.profit for trade in self.trade_history])
        wins = profits[profits > 0]
        losses = profits[profits < 0]

        if wins.size == 0 or losses.size == 0:
            return float(config.get("minLotSize", 0.01))

        win_rate = wins.size / profits.size
        avg_win = wins.mean()
        avg_loss = abs(losses.mean())
        b = avg_win / avg_loss if avg_loss > 0 else 1
        q = 1 - win_rate
        kelly_fraction = (win_rate * b - q) / b if b else 0
        kelly_fraction = max(0, min(kelly_fraction * 0.25, 0.1))

        equity = float(account_info.get("equity", account_info.get("balance", 0)))
        risk_amount = equity * kelly_fraction
        lot_size = risk_amount / float(config.get("contractValue", 10000))
        return self._clamp(lot_size, config)

    def _atr_based(self, account_info: Dict, config: Dict, market: Dict) -> float:
        atr = float(market.get("atr", config.get("fallbackATR", 1)))
        equity = float(account_info.get("equity", account_info.get("balance", 0)))
        account_risk = float(config.get("accountRiskPercentage", 1.0)) / 100
        risk_amount = equity * account_risk
        atr_multiplier = float(config.get("atrMultiplier", 2.0))
        stop_distance = atr * atr_multiplier
        if stop_distance <= 0:
            return self._clamp(config.get("minLotSize", 0.01), config)
        position_value = risk_amount / stop_distance
        lot_size = position_value / float(config.get("contractValue", 100000))
        return self._clamp(lot_size, config)

    def _volatility_based(self, account_info: Dict, config: Dict, market: Dict) -> float:
        base_lot = float(config.get("baseLotSize", 0.1))
        current_vol = float(market.get("volatility", 1.0)) or 1.0
        normal_vol = float(config.get("normalVolatility", 1.0)) or 1.0
        ratio = normal_vol / current_vol
        lot_size = base_lot * ratio
        return self._clamp(lot_size, config)

    def _equity_based(self, account_info: Dict, config: Dict) -> float:
        equity = float(account_info.get("equity", account_info.get("balance", 0)))
        percentage = float(config.get("equityPercentage", 0.01))
        contract_value = float(config.get("contractValue", 100000))
        lot_size = (equity * percentage) / contract_value
        return self._clamp(lot_size, config)

    def _clamp(self, lot: float, config: Dict) -> float:
        min_lot = float(config.get("minLotSize", 0.01))
        max_lot = float(config.get("maxLotSize", 2.0))
        return max(min_lot, min(lot, max_lot))


__all__ = ["DynamicRiskManager"]
