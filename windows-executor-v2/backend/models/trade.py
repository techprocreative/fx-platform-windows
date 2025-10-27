from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class TradeExecutionResult(BaseModel):
    success: bool
    ticket: Optional[int] = None
    price: Optional[float] = None
    volume: Optional[float] = None
    error: Optional[str] = None
    executed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
