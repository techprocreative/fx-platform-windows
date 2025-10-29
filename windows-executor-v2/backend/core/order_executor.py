from __future__ import annotations

from typing import Dict, Any
from .mt5_client import MT5Client, mt5


class OrderExecutor:
    def __init__(self, mt5_client: MT5Client) -> None:
        self.mt5 = mt5_client

    def pip_value(self, symbol: str) -> float:
        if mt5 is None:
            return 1.0
        info = mt5.symbol_info(symbol)
        if not info:
            return 1.0
        # Approximate pip value per 1 lot
        return getattr(info, 'point', 0.0001) * 10_000

    def open_position(self, symbol: str, side: str, lots: float, sl: float = None, tp: float = None, comment: str = "") -> Dict[str, Any]:
        if mt5 is None:
            return {"success": True, "ticket": "SIM-0"}
        if not self.mt5.initialized:
            if not self.mt5.initialize():
                return {"success": False, "error": "MT5 init failed"}
        tick = mt5.symbol_info_tick(symbol)
        if not tick:
            return {"success": False, "error": "No tick"}
        order_type = mt5.ORDER_TYPE_BUY if side == 'BUY' else mt5.ORDER_TYPE_SELL
        price = tick.ask if order_type == mt5.ORDER_TYPE_BUY else tick.bid
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": float(lots),
            "type": order_type,
            "price": price,
            "sl": sl or 0.0,
            "tp": tp or 0.0,
            "deviation": 10,
            "magic": 923451,
            "comment": comment or "ExecutorV2",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_FOK,
        }
        result = mt5.order_send(request)
        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            return {"success": True, "ticket": result.order or result.deal}
        return {"success": False, "error": getattr(result, 'comment', 'unknown')}

    def modify_sl_tp(self, ticket: int, symbol: str, sl: float, tp: float) -> Dict[str, Any]:
        if mt5 is None:
            return {"success": True}
        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "symbol": symbol,
            "ticket": ticket,
            "sl": sl,
            "tp": tp,
        }
        result = mt5.order_send(request)
        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            return {"success": True}
        return {"success": False, "error": getattr(result, 'comment', 'unknown')}

    def close_partial(self, ticket: int, symbol: str, volume: float, side: str) -> Dict[str, Any]:
        if mt5 is None:
            return {"success": True}
        tick = mt5.symbol_info_tick(symbol)
        if not tick:
            return {"success": False, "error": "No tick"}
        opposite = mt5.ORDER_TYPE_SELL if side == 'BUY' else mt5.ORDER_TYPE_BUY
        price = tick.bid if opposite == mt5.ORDER_TYPE_SELL else tick.ask
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": float(volume),
            "type": opposite,
            "position": ticket,
            "price": price,
            "deviation": 10,
            "magic": 923451,
            "comment": "PartialExit",
        }
        result = mt5.order_send(request)
        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            return {"success": True, "deal": result.order or result.deal}
        return {"success": False, "error": getattr(result, 'comment', 'unknown')}
