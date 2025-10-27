from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class PartialExitLevel:
    trigger_price: float
    exit_lots: float
    percentage: float
    executed: bool = False
    priority: int = 99


class PartialExitManager:
    """Manage execution of partial exits based on configured levels."""

    def __init__(self, mt5_client) -> None:
        self.mt5_client = mt5_client
        self.exit_levels: Dict[int, List[PartialExitLevel]] = {}

    def setup_exit_levels(self, position: Dict, config: Dict) -> List[PartialExitLevel]:
        if not config.get("enabled", False):
            return []

        strategy = config.get("strategy", "sequential")
        levels_config = config.get("levels", [])
        remaining_volume = float(position.get("volume", position.get("lots", 0)))

        levels: List[PartialExitLevel] = []
        for entry in levels_config:
            percentage = float(entry.get("percentage", 0))
            if percentage <= 0:
                continue
            exit_volume = remaining_volume * (percentage / 100)
            trigger = entry.get("trigger", {})
            trigger_price = self._calculate_trigger_price(position, trigger)
            levels.append(
                PartialExitLevel(
                    trigger_price=trigger_price,
                    exit_lots=round(exit_volume, 2),
                    percentage=percentage,
                    priority=int(entry.get("priority", 99)),
                )
            )
            if strategy == "sequential":
                remaining_volume -= exit_volume

        levels.sort(key=lambda lvl: lvl.priority)
        self.exit_levels[position["ticket"]] = levels
        return levels

    def check_partial_exits(self, position: Dict, current_price: float) -> Optional[Dict]:
        levels = self.exit_levels.get(position["ticket"], [])
        if not levels:
            return None

        for level in levels:
            if level.executed:
                continue
            if position["type"] == "BUY" and current_price >= level.trigger_price:
                return self._execute(position, level, current_price)
            if position["type"] == "SELL" and current_price <= level.trigger_price:
                return self._execute(position, level, current_price)
        return None

    def _execute(self, position: Dict, level: PartialExitLevel, price: float) -> Dict:
        try:
            result = self.mt5_client.close_position_partial(
                ticket=position["ticket"],
                volume=level.exit_lots,
            )
            if result.get("success"):
                level.executed = True
                logger.info(
                    "Partial exit executed for %s. Percentage=%s price=%s",
                    position["ticket"],
                    level.percentage,
                    price,
                )
                return {
                    "success": True,
                    "exitLots": level.exit_lots,
                    "percentage": level.percentage,
                    "price": price,
                }
            logger.warning("Partial exit failed: %s", result.get("error"))
            return {"success": False, "error": result.get("error")}
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("Partial exit error")
            return {"success": False, "error": str(exc)}

    def _calculate_trigger_price(self, position: Dict, trigger: Dict) -> float:
        trigger_type = trigger.get("type", "pips").lower()
        value = float(trigger.get("value", 0))
        entry_price = float(position.get("openPrice"))

        point = float(position.get("point", 0.0001))

        if trigger_type == "rr_ratio":
            risk = abs(entry_price - float(position.get("stopLoss", entry_price)))
            move = risk * value
        elif trigger_type == "percentage":
            move = entry_price * (value / 100)
        else:  # pips
            move = value * point * 10

        if position["type"] == "BUY":
            return entry_price + move
        return entry_price - move


__all__ = ["PartialExitManager", "PartialExitLevel"]
