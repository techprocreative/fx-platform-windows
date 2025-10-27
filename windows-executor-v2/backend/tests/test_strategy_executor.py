from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import pandas as pd
import pytest

from backend.core.strategy_executor import StrategyExecutor
from backend.models.strategy import StrategyConfig


class FakeMT5Client:
    def __init__(self) -> None:
        self.initialized = True
        self._positions: Dict[int, Dict[str, Any]] = {}
        self._ticket = 1000

    def get_candles(self, symbol: str, timeframe: str, count: int = 200) -> pd.DataFrame:
        data = {
            "time": pd.date_range(end=datetime.now(timezone.utc), periods=count, freq="T"),
            "open": [1.10 + i * 0.0001 for i in range(count)],
            "high": [1.11 + i * 0.0001 for i in range(count)],
            "low": [1.09 + i * 0.0001 for i in range(count)],
            "close": [1.10 + i * 0.0001 for i in range(count)],
            "tick_volume": [100] * count,
        }
        return pd.DataFrame(data)

    def get_account_info(self) -> Dict[str, Any]:
        return {
            "balance": 10000,
            "equity": 10000,
            "openPositions": len(self._positions),
        }

    def get_symbol_info(self, symbol: str) -> Optional[Dict[str, Any]]:
        return {
            "symbol": symbol,
            "bid": 1.2010,
            "ask": 1.2012,
            "spread": 1.5,
            "point": 0.0001,
            "digits": 5,
            "volume_min": 0.01,
            "volume_max": 10,
            "volume_step": 0.01,
            "trade_allowed": True,
        }

    def open_position(
        self,
        symbol: str,
        order_type: str,
        lot_size: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        comment: str = "",
    ) -> Dict[str, Any]:
        self._ticket += 1
        ticket = self._ticket
        self._positions[ticket] = {
            "ticket": ticket,
            "symbol": symbol,
            "type": order_type,
            "volume": lot_size,
            "price": 1.2011,
            "stopLoss": stop_loss,
            "takeProfit": take_profit,
            "point": 0.0001,
            "digits": 5,
            "openPrice": 1.2011,
            "currentPrice": 1.2011,
            "openTime": datetime.now(timezone.utc),
            "profit": 0.0,
            "swap": 0.0,
            "commission": 0.0,
            "comment": comment,
        }
        return {
            "success": True,
            "ticket": ticket,
            "price": 1.2011,
            "volume": lot_size,
        }

    def get_positions(self) -> List[Dict[str, Any]]:
        return list(self._positions.values())

    def close_position_partial(self, ticket: int, volume: float) -> Dict[str, Any]:
        position = self._positions.get(ticket)
        if not position:
            return {"success": False, "error": "not found"}
        position["volume"] = max(position["volume"] - volume, 0)
        if position["volume"] <= 0:
            self._positions.pop(ticket, None)
        return {"success": True, "ticket": ticket, "volume": volume}

    def modify_position_sl_tp(self, ticket: int, stop_loss: Optional[float] = None, take_profit: Optional[float] = None) -> Dict[str, Any]:
        position = self._positions.get(ticket)
        if not position:
            return {"success": False, "error": "not found"}
        if stop_loss is not None:
            position["stopLoss"] = stop_loss
        if take_profit is not None:
            position["takeProfit"] = take_profit
        return {"success": True}


class FakePusherClient:
    def register_loop(self, loop: asyncio.AbstractEventLoop) -> None:  # pragma: no cover - not needed in tests
        pass

    def attach_queue(self, queue: asyncio.Queue) -> None:  # pragma: no cover - not needed in tests
        pass


class FakePusherEmitter:
    def emit_trading_signal(self, signal_data: Dict[str, Any]) -> None:
        pass

    def emit_position_opened(self, position_data: Dict[str, Any]) -> None:
        pass

    def emit_position_closed(self, close_data: Dict[str, Any]) -> None:
        pass

    def emit_strategy_status(self, strategy_data: Dict[str, Any]) -> None:
        pass

    def emit_account_update(self, account_data: Dict[str, Any]) -> None:
        pass


@pytest.mark.asyncio
async def test_strategy_executor_opens_trade_when_conditions_met():
    mt5 = FakeMT5Client()
    executor = StrategyExecutor(mt5, FakePusherClient(), FakePusherEmitter())

    strategy = StrategyConfig.model_validate(
        {
            "strategyId": "strat-1",
            "strategyName": "EMA Trend",
            "symbol": "EURUSD",
            "timeframe": "M15",
            "rules": {
                "entry": {
                    "logic": "OR",
                    "conditions": [
                        {
                            "indicator": "price",
                            "condition": "greater_than",
                            "value": 1.0,
                        }
                    ],
                },
                "riskManagement": {
                    "lotSize": 0.1,
                    "maxPositions": 3,
                },
                "exit": {
                    "stopLoss": {"type": "pips", "value": 20},
                    "takeProfit": {"type": "pips", "value": 20},
                },
            },
        }
    )

    await executor.start_strategy(strategy)
    await executor.run_cycle()

    assert len(mt5.get_positions()) == 1
    status_list = await executor.list_statuses()
    assert status_list[0].trades_count == 1
