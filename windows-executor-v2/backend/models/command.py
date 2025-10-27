from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field, ConfigDict


CommandType = Literal[
    "START_STRATEGY",
    "STOP_STRATEGY",
    "PING",
]


class ExecutorCommand(BaseModel):
    id: str
    command: CommandType
    executor_id: str = Field(alias="executorId")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(alias="createdAt")
    expires_at: Optional[datetime] = Field(default=None, alias="expiresAt")

    model_config = ConfigDict(populate_by_name=True)
