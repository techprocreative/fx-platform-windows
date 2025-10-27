from __future__ import annotations

import logging
from datetime import datetime, timedelta, date
from typing import Dict, List, Tuple

from risk_manager import RiskManager

logger = logging.getLogger(__name__)


class AdvancedRiskManager(RiskManager):
    """Enhanced risk management with daily limits, drawdown tracking, and correlation checks."""

    def __init__(self) -> None:
        super().__init__()
        self.daily_trades: Dict[date, int] = {}
        self.daily_loss: Dict[date, float] = {}
        self.daily_profit: Dict[date, float] = {}
        self.peak_balance: float = 0
        self.symbol_positions: Dict[str, int] = {}

    def can_open_position(
        self,
        account_info: Dict,
        risk_rules: Dict,
        symbol: str,
        current_positions: List[Dict],
    ) -> Tuple[bool, str]:
        """Comprehensive risk checks before opening position."""

        # Check basic position limit
        max_positions = int(risk_rules.get("maxPositions", 3))
        if len(current_positions) >= max_positions:
            return False, f"Max positions reached ({max_positions})"

        # Check max daily trades
        max_daily_trades = int(risk_rules.get("maxDailyTrades", 0))
        if max_daily_trades > 0:
            today = datetime.now().date()
            trades_today = self.daily_trades.get(today, 0)
            if trades_today >= max_daily_trades:
                return False, f"Max daily trades reached ({trades_today}/{max_daily_trades})"

        # Check max daily loss
        max_daily_loss = float(risk_rules.get("maxDailyLoss", 0))
        if max_daily_loss > 0:
            today = datetime.now().date()
            daily_loss = self.daily_loss.get(today, 0)
            if daily_loss >= max_daily_loss:
                return False, f"Max daily loss reached (${daily_loss:.2f}/${max_daily_loss:.2f})"

        # Check max drawdown
        max_drawdown = float(risk_rules.get("maxDrawdown", 0))
        if max_drawdown > 0:
            current_dd = self._calculate_current_drawdown(account_info)
            if current_dd >= max_drawdown:
                return False, f"Max drawdown reached ({current_dd:.2f}%/{max_drawdown}%)"

        # Check max positions per symbol
        max_per_symbol = int(risk_rules.get("maxPositionsPerSymbol", 2))
        symbol_count = self.symbol_positions.get(symbol, 0)
        if symbol_count >= max_per_symbol:
            return False, f"Max positions for {symbol} reached ({symbol_count}/{max_per_symbol})"

        # Check correlation risk
        if risk_rules.get("correlationCheck", {}).get("enabled", False):
            corr_passed, corr_reason = self._check_correlation_risk(
                symbol, current_positions, risk_rules.get("correlationCheck", {})
            )
            if not corr_passed:
                return False, corr_reason

        # Check consecutive losses
        max_consecutive_losses = int(risk_rules.get("maxConsecutiveLosses", 0))
        if max_consecutive_losses > 0:
            consecutive = self._count_consecutive_losses()
            if consecutive >= max_consecutive_losses:
                return False, f"Max consecutive losses reached ({consecutive})"

        return True, "All risk checks passed"

    def register_trade(self, symbol: str, profit: float, is_open: bool = False) -> None:
        """Track trade for risk management."""
        today = datetime.now().date()

        if is_open:
            # Track open position
            self.symbol_positions[symbol] = self.symbol_positions.get(symbol, 0) + 1
        else:
            # Track closed position
            self.daily_trades[today] = self.daily_trades.get(today, 0) + 1

            if profit < 0:
                self.daily_loss[today] = self.daily_loss.get(today, 0) + abs(profit)
            else:
                self.daily_profit[today] = self.daily_profit.get(today, 0) + profit

            # Decrease symbol position count
            if symbol in self.symbol_positions:
                self.symbol_positions[symbol] = max(0, self.symbol_positions[symbol] - 1)

        # Cleanup old data
        self._cleanup_old_data()

    def update_peak_balance(self, current_balance: float) -> None:
        """Update peak balance for drawdown calculation."""
        if current_balance > self.peak_balance:
            self.peak_balance = current_balance

    def _calculate_current_drawdown(self, account_info: Dict) -> float:
        """Calculate current drawdown percentage."""
        balance = float(account_info.get("balance", 0))
        equity = float(account_info.get("equity", balance))

        if balance <= 0:
            return 0.0

        # Update peak
        self.update_peak_balance(balance)

        if self.peak_balance <= 0:
            return 0.0

        # Calculate drawdown from peak
        drawdown = ((self.peak_balance - equity) / self.peak_balance) * 100
        return max(0, drawdown)

    def _check_correlation_risk(
        self, symbol: str, current_positions: List[Dict], config: Dict
    ) -> Tuple[bool, str]:
        """Check correlation with existing positions."""
        max_correlated = int(config.get("maxCorrelatedPositions", 2))

        # Get base currency (first 3 characters)
        base_currency = symbol[:3]

        # Count positions with same base currency
        same_base_count = sum(
            1 for pos in current_positions if pos.get("symbol", "")[:3] == base_currency
        )

        if same_base_count >= max_correlated:
            return False, f"Too many correlated positions ({same_base_count}/{max_correlated}) for {base_currency}"

        return True, "Correlation check passed"

    def _count_consecutive_losses(self) -> int:
        """Count consecutive losing trades."""
        # Simple implementation - track last N trades
        # In real implementation, should track from database
        return 0  # Placeholder

    def _cleanup_old_data(self) -> None:
        """Remove data older than 7 days."""
        cutoff = datetime.now().date() - timedelta(days=7)

        self.daily_trades = {
            trade_date: count
            for trade_date, count in self.daily_trades.items()
            if trade_date >= cutoff
        }

        self.daily_loss = {
            trade_date: loss
            for trade_date, loss in self.daily_loss.items()
            if trade_date >= cutoff
        }

        self.daily_profit = {
            trade_date: profit
            for trade_date, profit in self.daily_profit.items()
            if trade_date >= cutoff
        }

    def get_daily_stats(self) -> Dict:
        """Get today's trading statistics."""
        today = datetime.now().date()

        return {
            "trades": self.daily_trades.get(today, 0),
            "profit": self.daily_profit.get(today, 0),
            "loss": self.daily_loss.get(today, 0),
            "net": self.daily_profit.get(today, 0) - self.daily_loss.get(today, 0),
            "positions_by_symbol": dict(self.symbol_positions),
        }


__all__ = ["AdvancedRiskManager"]
