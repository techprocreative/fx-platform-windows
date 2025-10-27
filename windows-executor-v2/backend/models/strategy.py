from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, ConfigDict


class StrategyConfig(BaseModel):
    id: str = Field(alias="strategyId")
    name: str = Field(alias="strategyName")
    symbol: str
    timeframe: str
    rules: Dict[str, Any]
    settings: Dict[str, Any] = Field(default_factory=dict)
    options: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True)


class StrategyStatus(BaseModel):
    id: str
    name: str
    symbol: str
    timeframe: str
    status: str
    started_at: datetime
    last_check: Optional[datetime]
    trades_count: int
