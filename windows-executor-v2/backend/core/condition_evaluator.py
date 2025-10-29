from __future__ import annotations

from typing import Dict, Any, Optional


class ConditionEvaluator:
    def compare(self, left: float, op: str, right: float) -> bool:
        op = (op or '').lower()
        if left is None or right is None:
            return False
        if op == 'greater_than':
            return left > right
        if op == 'less_than':
            return left < right
        if op == 'equal':
            return abs(left - right) < 1e-9
        if op == 'in_range' and isinstance(right, (list, tuple)) and len(right) == 2:
            return right[0] <= left <= right[1]
        if op == 'outside_range' and isinstance(right, (list, tuple)) and len(right) == 2:
            return not (right[0] <= left <= right[1])
        return False

    def crosses(self, prev_left: float, curr_left: float, prev_right: float, curr_right: float, direction: str) -> bool:
        if None in (prev_left, curr_left, prev_right, curr_right):
            return False
        if direction == 'crosses_above':
            return prev_left <= prev_right and curr_left > curr_right
        if direction == 'crosses_below':
            return prev_left >= prev_right and curr_left < curr_right
        return False

