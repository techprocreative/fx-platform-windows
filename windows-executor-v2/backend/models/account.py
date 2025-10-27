from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AccountInfo(BaseModel):
    balance: float
    equity: float
    margin: float
    free_margin: float = Field(alias="freeMargin")
    margin_level: float = Field(alias="marginLevel")
    profit: float
    currency: str
    leverage: int
    account_number: str = Field(alias="accountNumber")
    server: str
    company: Optional[str]
    open_positions: int = Field(alias="openPositions")

    model_config = ConfigDict(populate_by_name=True)
