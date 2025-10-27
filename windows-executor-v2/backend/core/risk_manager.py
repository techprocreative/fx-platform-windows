from __future__ import annotations

from typing import Dict


class RiskManager:
    """Basic risk calculations for lot sizing and guardrails."""

    def calculate_position_size(self, account_info: Dict, risk_rules: Dict, _dynamic: Dict | None = None) -> float:
        lot_size = risk_rules.get("lotSize")
        if lot_size:
            return float(lot_size)

        balance = float(account_info.get("balance", 0))
        risk_percentage = float(risk_rules.get("riskPercentage", 1.0))
        stop_loss_pips = float(risk_rules.get("stopLossPips", 30))

        risk_amount = balance * (risk_percentage / 100)
        pip_value = risk_rules.get("pipValue", 10)
        if pip_value <= 0 or stop_loss_pips <= 0:
            return 0.01

        lot = risk_amount / (pip_value * stop_loss_pips)
        min_lot = risk_rules.get("minLot", 0.01)
        max_lot = risk_rules.get("maxLot", 1.0)
        return max(min(lot, max_lot), min_lot)

    def can_open_position(self, account_info: Dict, risk_rules: Dict) -> bool:
        max_positions = int(risk_rules.get("maxPositions", 3))
        open_positions = int(account_info.get("openPositions", 0))
        if open_positions >= max_positions:
            return False

        max_daily_loss = float(risk_rules.get("maxDailyLoss", 0))
        if max_daily_loss:
            # Placeholder: integrate with trade history once available
            pass

        return True


__all__ = ["RiskManager"]
