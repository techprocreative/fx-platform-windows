from __future__ import annotations

import logging
import os
import time
from datetime import datetime
from typing import Dict, List, Optional

import pandas as pd

try:
    import MetaTrader5 as mt5  # type: ignore
except ImportError:  # pragma: no cover - MetaTrader5 not available in CI
    mt5 = None

logger = logging.getLogger(__name__)


class MT5Client:
    """MetaTrader 5 client with auto-detection support."""

    def __init__(self, pusher_emitter=None) -> None:
        self.initialized = False
        self.account_info: Optional[Dict] = None
        self.mt5_path: Optional[str] = None
        self.pusher_emitter = pusher_emitter

    def initialize(self, path: Optional[str] = None) -> bool:
        if mt5 is None:
            logger.warning("MetaTrader5 package not installed; skipping initialization")
            return False

        path = path or self._auto_detect_mt5()
        if not path:
            logger.error("MT5 terminal path not provided or auto-detected")
            return False

        self.mt5_path = path

        if not mt5.initialize(path=path):
            error = mt5.last_error()
            logger.error("MT5 initialization failed: %s", error)
            if error and error[0] == -1:
                logger.info("Attempting to launch MT5 terminal at %s", path)
                os.startfile(path)
                time.sleep(10)
                if not mt5.initialize(path=path):
                    logger.error("MT5 re-initialization failed: %s", mt5.last_error())
                    return False
            else:
                return False

        self.initialized = True
        self.account_info = self._fetch_account_info()
        if not self.account_info:
            logger.error("MT5 account information unavailable; ensure login is complete")
            return False

        logger.info(
            "MT5 initialized for account %s on %s",
            self.account_info["accountNumber"],
            self.account_info["server"],
        )
        return True

    def shutdown(self) -> None:
        if mt5 is None:
            return
        if self.initialized:
            mt5.shutdown()
            self.initialized = False
            logger.info("MT5 connection closed")

    def get_account_info(self) -> Optional[Dict]:
        if mt5 is None or not self.initialized:
            return None
        return self._fetch_account_info()

    def get_symbol_info(self, symbol: str) -> Optional[Dict]:
        if mt5 is None or not self.initialized:
            return None
        info = mt5.symbol_info(symbol)
        if info is None:
            return None
        return {
            "symbol": info.name,
            "bid": info.bid,
            "ask": info.ask,
            "spread": info.spread,
            "point": info.point,
            "digits": info.digits,
            "volume_min": info.volume_min,
            "volume_max": info.volume_max,
            "volume_step": info.volume_step,
            "trade_allowed": info.trade_mode == mt5.SYMBOL_TRADE_MODE_FULL,
        }

    def get_candles(self, symbol: str, timeframe: str, count: int = 500) -> pd.DataFrame:
        if mt5 is None or not self.initialized:
            return pd.DataFrame()

        timeframe_map = {
            "M1": mt5.TIMEFRAME_M1,
            "M5": mt5.TIMEFRAME_M5,
            "M15": mt5.TIMEFRAME_M15,
            "M30": mt5.TIMEFRAME_M30,
            "H1": mt5.TIMEFRAME_H1,
            "H4": mt5.TIMEFRAME_H4,
            "D1": mt5.TIMEFRAME_D1,
            "W1": mt5.TIMEFRAME_W1,
        }
        tf = timeframe_map.get(timeframe, mt5.TIMEFRAME_M15)
        rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
        if rates is None:
            logger.error("Failed to fetch rates for %s %s: %s", symbol, timeframe, mt5.last_error())
            return pd.DataFrame()

        df = pd.DataFrame(rates)
        df["time"] = pd.to_datetime(df["time"], unit="s")
        return df

    def open_position(
        self,
        symbol: str,
        order_type: str,
        lot_size: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        comment: str = "",
    ) -> Dict:
        if mt5 is None or not self.initialized:
            return {"success": False, "error": "MT5 not initialized"}

        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            return {"success": False, "error": "Symbol not found"}

        if not symbol_info.visible:
            if not mt5.symbol_select(symbol, True):
                return {"success": False, "error": "Failed to select symbol"}

        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return {"success": False, "error": "No tick data"}

        if order_type.upper() == "BUY":
            price = tick.ask
            mt5_type = mt5.ORDER_TYPE_BUY
        else:
            price = tick.bid
            mt5_type = mt5.ORDER_TYPE_SELL

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": float(lot_size),
            "type": mt5_type,
            "price": price,
            "deviation": 10,
            "magic": 123456,
            "comment": comment[:31],
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_FOK,
        }

        if stop_loss is not None:
            request["sl"] = stop_loss
        if take_profit is not None:
            request["tp"] = take_profit

        result = mt5.order_send(request)
        if result is None:
            return {"success": False, "error": "Order send failed"}

        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {
                "success": False,
                "error": f"Order failed: {result.retcode} - {result.comment}",
            }

        response = {
            "success": True,
            "ticket": result.order,
            "price": result.price,
            "volume": result.volume,
        }
        
        # Emit position opened event
        if self.pusher_emitter:
            self.pusher_emitter.emit_position_opened({
                "ticket": result.order,
                "symbol": symbol,
                "type": order_type.upper(),
                "volume": float(lot_size),
                "entry_price": result.price,
                "stop_loss": stop_loss,
                "take_profit": take_profit,
                "strategy_name": comment or "Manual"
            })
        
        return response

    def close_position(self, ticket: int) -> Dict:
        if mt5 is None or not self.initialized:
            return {"success": False, "error": "MT5 not initialized"}

        positions = mt5.positions_get(ticket=ticket)
        if not positions:
            return {"success": False, "error": "Position not found"}

        position = positions[0]
        tick = mt5.symbol_info_tick(position.symbol)
        if tick is None:
            return {"success": False, "error": "Tick data unavailable"}

        if position.type == mt5.ORDER_TYPE_BUY:
            close_type = mt5.ORDER_TYPE_SELL
            price = tick.bid
        else:
            close_type = mt5.ORDER_TYPE_BUY
            price = tick.ask

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": position.symbol,
            "volume": position.volume,
            "type": close_type,
            "position": ticket,
            "price": price,
            "deviation": 10,
            "magic": 123456,
            "comment": "Close",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_FOK,
        }

        result = mt5.order_send(request)
        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            # Emit position closed event
            if self.pusher_emitter:
                from datetime import datetime, timezone
                entry_time = datetime.fromtimestamp(position.time)
                duration = (datetime.now(timezone.utc) - entry_time).total_seconds()
                self.pusher_emitter.emit_position_closed({
                    "ticket": ticket,
                    "symbol": position.symbol,
                    "type": "BUY" if position.type == mt5.ORDER_TYPE_BUY else "SELL",
                    "volume": position.volume,
                    "entry_price": position.price_open,
                    "exit_price": price,
                    "profit": position.profit,
                    "duration": duration,
                    "reason": "Manual"
                })
            return {"success": True, "ticket": ticket}

        return {
            "success": False,
            "error": getattr(result, "comment", "Close failed"),
        }

    def get_positions(self) -> List[Dict]:
        if mt5 is None or not self.initialized:
            return []
        positions = mt5.positions_get()
        if positions is None:
            return []

        return [self._position_to_dict(pos) for pos in positions]

    def close_position_partial(self, ticket: int, volume: float) -> Dict:
        if mt5 is None or not self.initialized:
            return {"success": False, "error": "MT5 not initialized"}

        positions = mt5.positions_get(ticket=ticket)
        if not positions:
            return {"success": False, "error": "Position not found"}

        position = positions[0]
        if volume <= 0 or volume > position.volume:
            return {"success": False, "error": "Invalid partial volume"}

        tick = mt5.symbol_info_tick(position.symbol)
        if tick is None:
            return {"success": False, "error": "Tick data unavailable"}

        if position.type == mt5.ORDER_TYPE_BUY:
            close_type = mt5.ORDER_TYPE_SELL
            price = tick.bid
        else:
            close_type = mt5.ORDER_TYPE_BUY
            price = tick.ask

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": position.symbol,
            "volume": float(volume),
            "type": close_type,
            "position": ticket,
            "price": price,
            "deviation": 10,
            "magic": 123456,
            "comment": "PartialClose",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(request)
        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            return {"success": True, "ticket": ticket, "volume": volume}

        return {
            "success": False,
            "error": getattr(result, "comment", "Partial close failed"),
        }

    def modify_position_sl_tp(self, ticket: int, stop_loss: Optional[float] = None, take_profit: Optional[float] = None) -> Dict:
        if mt5 is None or not self.initialized:
            return {"success": False, "error": "MT5 not initialized"}

        if stop_loss is None and take_profit is None:
            return {"success": False, "error": "No modifications requested"}

        result = mt5.order_send(
            {
                "action": mt5.TRADE_ACTION_SLTP,
                "position": ticket,
                "sl": stop_loss,
                "tp": take_profit,
            }
        )

        if result is None:
            return {"success": False, "error": "Modification request failed"}

        if result and result.retcode == mt5.TRADE_RETCODE_DONE:
            return {"success": True}

        return {"success": False, "error": getattr(result, "comment", "Failed to modify position")}

    def _position_to_dict(self, pos) -> Dict:
        symbol_info = mt5.symbol_info(pos.symbol) if mt5 else None
        point = symbol_info.point if symbol_info else 0.0001
        digits = symbol_info.digits if symbol_info else 5
        return {
            "ticket": pos.ticket,
            "symbol": pos.symbol,
            "type": "BUY" if pos.type == mt5.ORDER_TYPE_BUY else "SELL",
            "volume": pos.volume,
            "openPrice": pos.price_open,
            "currentPrice": pos.price_current,
            "stopLoss": pos.sl,
            "takeProfit": pos.tp,
            "profit": pos.profit,
            "swap": pos.swap,
            "commission": pos.commission,
            "openTime": datetime.fromtimestamp(pos.time),
            "comment": pos.comment,
            "point": point,
            "digits": digits,
        }

    def _auto_detect_mt5(self) -> Optional[str]:
        possible_paths = [
            r"C:\\Program Files\\MetaTrader 5\\terminal64.exe",
            r"C:\\Program Files (x86)\\MetaTrader 5\\terminal64.exe",
            r"C:\\Program Files\\MetaQuotes\\Terminal\\terminal64.exe",
            r"C:\\Program Files\\XM MT5\\terminal64.exe",
            r"C:\\Program Files\\Alpari MT5\\terminal64.exe",
            r"C:\\Program Files\\FBS MT5\\terminal64.exe",
            r"C:\\Program Files\\Exness MT5\\terminal64.exe",
        ]

        for path in possible_paths:
            if os.path.exists(path):
                logger.info("Detected MT5 terminal at %s", path)
                return path

        appdata = os.getenv("APPDATA")
        if appdata:
            terminal_dir = os.path.join(appdata, "MetaQuotes", "Terminal")
            if os.path.isdir(terminal_dir):
                for folder in os.listdir(terminal_dir):
                    terminal_path = os.path.join(terminal_dir, folder, "terminal64.exe")
                    if os.path.exists(terminal_path):
                        logger.info("Detected MT5 terminal in AppData at %s", terminal_path)
                        return terminal_path

        logger.warning("Unable to auto-detect MT5 installation")
        return None

    def _fetch_account_info(self) -> Optional[Dict]:
        if mt5 is None:
            return None
        info = mt5.account_info()
        if info is None:
            return None
        return {
            "balance": info.balance,
            "equity": info.equity,
            "margin": info.margin,
            "freeMargin": info.margin_free,
            "marginLevel": info.margin_level if info.margin else 0,
            "profit": info.profit,
            "currency": info.currency,
            "leverage": info.leverage,
            "accountNumber": str(info.login),
            "server": info.server,
            "company": info.company,
            "openPositions": mt5.positions_total(),
        }


__all__ = ["MT5Client"]
