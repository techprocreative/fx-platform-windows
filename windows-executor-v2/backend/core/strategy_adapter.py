from __future__ import annotations

from typing import Dict, Any, List


def normalize_rules(rules: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize web platform strategy rules into a unified internal shape.

    Supports:
      - entry.conditions (logic: AND/OR)
      - entry.primary + entry.confirmation (MTF style)
    """
    if not rules:
        return {"entry": {"logic": "AND", "conditions": []}}

    entry = rules.get("entry") or {}

    # Case A: plain conditions
    if "conditions" in entry:
        logic = entry.get("logic", "AND").upper()
        conditions = entry.get("conditions") or []
        return {
            "entry": {
                "logic": logic,
                "conditions": conditions,
            },
            "exit": rules.get("exit", {}),
            "riskManagement": rules.get("riskManagement", {}),
            "dynamicRisk": rules.get("dynamicRisk", {}),
            "sessionFilter": rules.get("sessionFilter", {}),
            "spreadFilter": rules.get("spreadFilter", {}),
            "volatilityFilter": rules.get("volatilityFilter", {}),
            "correlationFilter": rules.get("correlationFilter", {}),
        }

    # Case B: primary + confirmation (map to unified form, keep MTF metadata)
    primary: List[Dict[str, Any]] = (entry.get("primary") or [])
    confirmation: List[Dict[str, Any]] = (entry.get("confirmation") or [])

    conditions: List[Dict[str, Any]] = []
    for c in primary:
        if isinstance(c, dict):
            conditions.append(c)

    # Represent confirmations as conditions with metadata
    for conf in confirmation:
        if not isinstance(conf, dict):
            continue
        cond = conf.get("condition") or {}
        if not isinstance(cond, dict):
            continue
        merged = {
            **cond,
            "_mtf": {
                "timeframe": conf.get("timeframe"),
                "required": bool(conf.get("required")),
            },
        }
        conditions.append(merged)

    return {
        "entry": {
            "logic": entry.get("logic", "AND").upper(),
            "conditions": conditions,
        },
        "exit": rules.get("exit", {}),
        "riskManagement": rules.get("riskManagement", {}),
        "dynamicRisk": rules.get("dynamicRisk", {}),
        "sessionFilter": rules.get("sessionFilter", {}),
        "spreadFilter": rules.get("spreadFilter", {}),
        "volatilityFilter": rules.get("volatilityFilter", {}),
        "correlationFilter": rules.get("correlationFilter", {}),
    }

