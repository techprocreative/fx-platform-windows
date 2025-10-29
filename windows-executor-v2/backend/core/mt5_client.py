from typing import Optional, Dict, Any
import logging

try:
    import MetaTrader5 as mt5
except Exception:  # pragma: no cover
    mt5 = None  # For environments without MT5 installed


logger = logging.getLogger(__name__)


class MT5Client:
    def __init__(self) -> None:
        self.initialized: bool = False

    def initialize(self, path: Optional[str] = None) -> bool:
        if mt5 is None:
            logger.error("MetaTrader5 module not available")
            return False
        try:
            if not mt5.initialize(path=path):
                logger.error(f"MT5 initialize failed: {mt5.last_error()}")
                return False
            self.initialized = True
            return True
        except Exception as e:  # pragma: no cover
            logger.exception("MT5 initialization error: %s", e)
            return False

    def get_account_info(self) -> Dict[str, Any]:
        if mt5 is None:
            return {"error": "mt5 module unavailable"}
        ai = mt5.account_info()
        if not ai:
            return {"error": "no account info"}
        return {
            "login": ai.login,
            "server": ai.server,
            "balance": ai.balance,
            "equity": ai.equity,
            "margin": ai.margin,
            "currency": ai.currency,
        }

    def shutdown(self) -> None:
        if mt5 is None:
            return
        try:
            mt5.shutdown()
        finally:
            self.initialized = False

