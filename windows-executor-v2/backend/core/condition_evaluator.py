from __future__ import annotations

from typing import Dict, List, Optional


class ConditionEvaluator:
    """Evaluate strategy conditions returned from web platform."""

    def evaluate(
        self,
        conditions: List[Dict],
        logic: str,
        indicators: Dict[str, float],
        candles,
    ) -> Optional[str]:
        matches = []
        for condition in conditions:
            result = self._evaluate_condition(condition, indicators)
            if "and" in condition and result:
                result = result and self._evaluate_condition(condition["and"], indicators)
            matches.append(result)

        if logic.upper() == "AND":
            signal = all(matches)
        else:
            signal = any(matches)

        if not signal:
            return None

        return self._resolve_direction(conditions)

    def _evaluate_condition(self, condition: Dict, indicators: Dict[str, float]) -> bool:
        indicator_value = indicators.get(condition["indicator"].lower())
        if indicator_value is None and condition["indicator"].lower() == "price":
            indicator_value = indicators.get("close")

        comparator = condition.get("condition", "greater_than")
        comparison_value = self._resolve_value(condition.get("value"), indicators)

        if indicator_value is None or comparison_value is None:
            return False

        if comparator == "greater_than":
            return indicator_value > comparison_value
        if comparator == "less_than":
            return indicator_value < comparison_value
        if comparator == "crosses_above":
            return indicator_value > comparison_value
        if comparator == "crosses_below":
            return indicator_value < comparison_value

        return False

    def _resolve_value(self, value, indicators: Dict[str, float]) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            lowered = value.lower()
            if lowered in indicators:
                return indicators[lowered]
            try:
                return float(value)
            except ValueError:
                return None
        return None

    def _resolve_direction(self, conditions: List[Dict]) -> str:
        for condition in conditions:
            description = condition.get("description", "").lower()
            if "sell" in description:
                return "SELL"
        return "BUY"


__all__ = ["ConditionEvaluator"]
