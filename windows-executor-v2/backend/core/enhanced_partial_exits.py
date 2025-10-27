from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class TriggerType(str, Enum):
    """Types of partial exit triggers."""

    PROFIT = "profit"
    TIME = "time"
    PRICE = "price"
    ATR = "atr"
    TRAILING = "trailing"
    REGIME = "regime"


@dataclass
class PartialExitLevel:
    """Configuration for a partial exit level."""

    id: str
    name: str
    percentage: float  # 0-100
    trigger_type: TriggerType
    trigger_value: float
    priority: int = 99
    executed: bool = False

    # Trigger-specific config
    profit_config: Optional[Dict] = None
    time_config: Optional[Dict] = None
    trailing_config: Optional[Dict] = None
    regime_config: Optional[Dict] = None


class EnhancedPartialExitManager:
    """Advanced partial exit system with multiple trigger types."""

    def __init__(self, mt5_client, regime_detector=None) -> None:
        self.mt5_client = mt5_client
        self.regime_detector = regime_detector
        self.active_levels: Dict[int, List[PartialExitLevel]] = {}
        self.peak_prices: Dict[int, float] = {}

    def setup_exit_levels(
        self, position: Dict, config: Dict
    ) -> List[PartialExitLevel]:
        """Setup multi-trigger partial exit levels."""
        if not config.get("enabled", False):
            return []

        levels = []
        for idx, level_config in enumerate(config.get("levels", [])):
            level = self._parse_exit_level(level_config, position, idx)
            if level:
                levels.append(level)

        # Sort by priority
        levels.sort(key=lambda x: x.priority)
        self.active_levels[position["ticket"]] = levels

        # Initialize peak price tracking for trailing
        self.peak_prices[position["ticket"]] = position.get("openPrice", 0)

        logger.info(
            f"Setup {len(levels)} partial exit levels for position {position['ticket']}"
        )
        return levels

    def check_exit_triggers(
        self, position: Dict, current_price: float, market_data: Optional[Dict] = None
    ) -> List[Dict]:
        """Check all trigger types and execute exits if triggered."""
        ticket = position["ticket"]
        levels = self.active_levels.get(ticket, [])
        if not levels:
            return []

        # Update peak price for trailing
        self._update_peak_price(ticket, current_price, position["type"])

        executions = []
        for level in levels:
            if level.executed:
                continue

            triggered, reason = self._check_trigger(level, position, current_price, market_data)

            if triggered:
                result = self._execute_partial_exit(position, level, current_price, reason)
                if result.get("success"):
                    executions.append(result)

        return executions

    def _parse_exit_level(
        self, config: Dict, position: Dict, idx: int
    ) -> Optional[PartialExitLevel]:
        """Parse exit level configuration."""
        try:
            percentage = float(config.get("percentage", 0))
            if percentage <= 0 or percentage > 100:
                return None

            trigger_type = TriggerType(config.get("triggerType", "profit"))
            trigger_value = float(config.get("triggerValue", 0))

            return PartialExitLevel(
                id=config.get("id", f"level_{idx}"),
                name=config.get("name", f"Exit Level {idx + 1}"),
                percentage=percentage,
                trigger_type=trigger_type,
                trigger_value=trigger_value,
                priority=int(config.get("priority", 99)),
                profit_config=config.get("profitTarget"),
                time_config=config.get("timeTarget"),
                trailing_config=config.get("trailingTarget"),
                regime_config=config.get("regimeTarget"),
            )
        except Exception as e:
            logger.error(f"Failed to parse exit level: {e}")
            return None

    def _check_trigger(
        self,
        level: PartialExitLevel,
        position: Dict,
        current_price: float,
        market_data: Optional[Dict],
    ) -> tuple[bool, str]:
        """Check if trigger condition is met."""

        if level.trigger_type == TriggerType.PROFIT:
            return self._check_profit_trigger(level, position, current_price)

        elif level.trigger_type == TriggerType.TRAILING:
            return self._check_trailing_trigger(level, position, current_price)

        elif level.trigger_type == TriggerType.ATR:
            return self._check_atr_trigger(level, position, current_price, market_data)

        elif level.trigger_type == TriggerType.TIME:
            return self._check_time_trigger(level, position)

        elif level.trigger_type == TriggerType.REGIME and self.regime_detector:
            return self._check_regime_trigger(level, position)

        elif level.trigger_type == TriggerType.PRICE:
            return self._check_price_trigger(level, position, current_price)

        return False, ""

    def _check_profit_trigger(
        self, level: PartialExitLevel, position: Dict, current_price: float
    ) -> tuple[bool, str]:
        """Check profit-based trigger."""
        if not level.profit_config:
            return False, ""

        entry_price = position.get("openPrice", 0)
        profit_type = level.profit_config.get("type", "pips")
        target_value = level.profit_config.get("value", 0)

        if position["type"] == "BUY":
            profit_diff = current_price - entry_price
        else:
            profit_diff = entry_price - current_price

        if profit_type == "pips":
            profit_pips = profit_diff * 10000
            if profit_pips >= target_value:
                return True, f"Profit target {profit_pips:.1f} pips reached"

        elif profit_type == "percentage":
            profit_pct = (profit_diff / entry_price) * 100
            if profit_pct >= target_value:
                return True, f"Profit {profit_pct:.2f}% reached"

        elif profit_type == "rr_ratio":
            stop_loss = position.get("stopLoss", entry_price)
            stop_distance = abs(entry_price - stop_loss)
            if stop_distance > 0:
                rr_ratio = abs(profit_diff) / stop_distance
                if rr_ratio >= target_value:
                    return True, f"Risk-reward {rr_ratio:.2f}:1 reached"

        return False, ""

    def _check_trailing_trigger(
        self, level: PartialExitLevel, position: Dict, current_price: float
    ) -> tuple[bool, str]:
        """Check trailing stop trigger."""
        if not level.trailing_config:
            return False, ""

        ticket = position["ticket"]
        peak_price = self.peak_prices.get(ticket, position.get("openPrice", 0))

        distance = level.trailing_config.get("distance", 30) * 0.0001

        if position["type"] == "BUY":
            trigger_price = peak_price - distance
            if current_price <= trigger_price:
                return True, f"Trailing stop triggered at {current_price:.5f}"
        else:
            trigger_price = peak_price + distance
            if current_price >= trigger_price:
                return True, f"Trailing stop triggered at {current_price:.5f}"

        return False, ""

    def _check_atr_trigger(
        self,
        level: PartialExitLevel,
        position: Dict,
        current_price: float,
        market_data: Optional[Dict],
    ) -> tuple[bool, str]:
        """Check ATR-based trigger."""
        if not market_data or "atr" not in market_data:
            return False, ""

        atr = market_data["atr"]
        entry_price = position.get("openPrice", 0)
        atr_multiplier = level.trigger_value

        target_distance = atr * atr_multiplier

        if position["type"] == "BUY":
            target_price = entry_price + target_distance
            if current_price >= target_price:
                return True, f"ATR target {atr_multiplier}x reached"
        else:
            target_price = entry_price - target_distance
            if current_price <= target_price:
                return True, f"ATR target {atr_multiplier}x reached"

        return False, ""

    def _check_time_trigger(
        self, level: PartialExitLevel, position: Dict
    ) -> tuple[bool, str]:
        """Check time-based trigger."""
        if not level.time_config:
            return False, ""

        entry_time_str = position.get("entryTime")
        if not entry_time_str:
            return False, ""

        try:
            entry_time = datetime.fromisoformat(entry_time_str)
            elapsed_minutes = (datetime.now() - entry_time).total_seconds() / 60
            target_minutes = level.time_config.get("minutes", 0)

            if elapsed_minutes >= target_minutes:
                return True, f"Time target {elapsed_minutes:.0f} minutes reached"
        except Exception:
            pass

        return False, ""

    def _check_regime_trigger(
        self, level: PartialExitLevel, position: Dict
    ) -> tuple[bool, str]:
        """Check regime-based trigger."""
        if not level.regime_config or not self.regime_detector:
            return False, ""

        try:
            current_regime = self.regime_detector.detect_regime(position["symbol"])
            target_regime = level.regime_config.get("regime")
            min_confidence = level.regime_config.get("confidence", 60)

            if (
                current_regime.regime == target_regime
                and current_regime.confidence >= min_confidence
            ):
                return True, f"Regime {target_regime} detected (confidence: {current_regime.confidence}%)"
        except Exception as e:
            logger.error(f"Regime check failed: {e}")

        return False, ""

    def _check_price_trigger(
        self, level: PartialExitLevel, position: Dict, current_price: float
    ) -> tuple[bool, str]:
        """Check absolute price trigger."""
        target_price = level.trigger_value

        if position["type"] == "BUY":
            if current_price >= target_price:
                return True, f"Target price {target_price:.5f} reached"
        else:
            if current_price <= target_price:
                return True, f"Target price {target_price:.5f} reached"

        return False, ""

    def _update_peak_price(self, ticket: int, current_price: float, position_type: str) -> None:
        """Update peak price for trailing stops."""
        peak = self.peak_prices.get(ticket, current_price)

        if position_type == "BUY":
            if current_price > peak:
                self.peak_prices[ticket] = current_price
        else:
            if current_price < peak:
                self.peak_prices[ticket] = current_price

    def _execute_partial_exit(
        self, position: Dict, level: PartialExitLevel, current_price: float, reason: str
    ) -> Dict:
        """Execute the partial exit."""
        try:
            current_volume = position.get("volume", 0)
            exit_lots = current_volume * (level.percentage / 100)

            result = self.mt5_client.close_position_partial(
                ticket=position["ticket"], volume=exit_lots
            )

            if result.get("success"):
                level.executed = True
                logger.info(
                    f"Partial exit executed: {position['ticket']} - {level.name} ({level.percentage}%)"
                )
                return {
                    "success": True,
                    "level_id": level.id,
                    "level_name": level.name,
                    "exit_lots": exit_lots,
                    "percentage": level.percentage,
                    "trigger_type": level.trigger_type.value,
                    "reason": reason,
                    "price": current_price,
                    "timestamp": datetime.now().isoformat(),
                }

            return {"success": False, "error": result.get("error")}

        except Exception as e:
            logger.error(f"Partial exit execution failed: {e}")
            return {"success": False, "error": str(e)}

    def cleanup_position(self, ticket: int) -> None:
        """Clean up data for closed position."""
        self.active_levels.pop(ticket, None)
        self.peak_prices.pop(ticket, None)


__all__ = ["EnhancedPartialExitManager", "PartialExitLevel", "TriggerType"]
