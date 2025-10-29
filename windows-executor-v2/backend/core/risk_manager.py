from __future__ import annotations

from typing import Dict, Any


class RiskManager:
    def __init__(self) -> None:
        self.daily_loss_limit_pct = None

    def lot_size(self, account: Dict[str, Any], params: Dict[str, Any], sl_pips: float, pip_value: float) -> float:
        # Fixed lot
        if params.get('lotSize'):
            return float(params['lotSize'])

        # % equity sizing
        risk_pct = params.get('riskPercentage') or params.get('riskPerTrade')
        if risk_pct and sl_pips and pip_value:
            equity = float(account.get('equity') or account.get('balance') or 0)
            risk_money = equity * (float(risk_pct) / 100.0)
            if risk_money <= 0:
                return 0.01
            lots = risk_money / (sl_pips * pip_value)
            return max(round(lots, 2), 0.01)

        return 0.01

    def under_limits(self, daily_loss_pct: float, max_daily_loss: float) -> bool:
        if max_daily_loss is None:
            return True
        return daily_loss_pct <= max_daily_loss

