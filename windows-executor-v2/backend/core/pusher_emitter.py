from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Global throttling state
_last_account_update = 0.0


class PusherEmitter:
    """Emit real-time events to frontend via Pusher HTTP API."""

    def __init__(self) -> None:
        self._pusher_client: Optional[Any] = None
        self._channel_name: Optional[str] = None
        self._enabled = False

    def initialize(self, app_id: str, key: str, secret: str, cluster: str, executor_id: str) -> None:
        """Initialize Pusher HTTP API client for sending events."""
        try:
            import pusher
            self._pusher_client = pusher.Pusher(
                app_id=app_id,
                key=key,
                secret=secret,
                cluster=cluster,
                ssl=True
            )
            self._channel_name = f"executor-{executor_id}"
            self._enabled = True
            logger.info("Pusher emitter initialized for channel: %s", self._channel_name)
        except ImportError:
            logger.warning("pusher package not installed; event emission disabled")
        except Exception as exc:
            logger.error("Failed to initialize Pusher emitter: %s", exc)

    def emit_trading_signal(self, signal_data: Dict[str, Any]) -> None:
        """Emit trading signal to frontend via Pusher."""
        if not self._enabled:
            return

        payload = {
            "id": signal_data.get("id") or str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "symbol": signal_data["symbol"],
            "type": signal_data["type"],  # "BUY" or "SELL"
            "entryPrice": signal_data["entry_price"],
            "stopLoss": signal_data.get("stop_loss"),
            "takeProfit": signal_data.get("take_profit"),
            "confidence": signal_data.get("confidence", 80),
            "strategy": signal_data["strategy_name"],
            "timeframe": signal_data["timeframe"],
            "indicators": {
                "ema": signal_data.get("ema_status"),
                "rsi": signal_data.get("rsi_value"),
                "macd": signal_data.get("macd_status"),
                "cci": signal_data.get("cci_value"),
            },
            "status": "pending",
            "reason": signal_data.get("reason", "Strategy conditions met")
        }

        self._trigger('trading-signal', payload)
        logger.info("Signal emitted: %s %s", payload['symbol'], payload['type'])

    def update_signal_status(self, signal_id: str, new_status: str, reason: Optional[str] = None) -> None:
        """Update signal status in frontend."""
        if not self._enabled:
            return

        payload = {
            "signalId": signal_id,
            "status": new_status,  # "executed", "expired", "rejected"
            "reason": reason,
            "timestamp": datetime.now().isoformat()
        }

        self._trigger('signal-status-update', payload)
        logger.info("Signal %s status updated to %s", signal_id, new_status)

    def emit_position_opened(self, position_data: Dict[str, Any]) -> None:
        """Emit when new position is opened."""
        if not self._enabled:
            return

        payload = {
            "ticket": position_data["ticket"],
            "symbol": position_data["symbol"],
            "type": position_data["type"],  # "BUY" or "SELL"
            "volume": position_data["volume"],
            "entry_price": position_data["entry_price"],
            "stop_loss": position_data.get("stop_loss"),
            "take_profit": position_data.get("take_profit"),
            "strategy": position_data.get("strategy_name"),
            "timestamp": datetime.now().isoformat()
        }

        self._trigger('position-opened', payload)
        logger.info("Position opened: %s %s #%s", payload['symbol'], payload['type'], payload['ticket'])

    def emit_position_closed(self, close_data: Dict[str, Any]) -> None:
        """Emit when position is closed."""
        if not self._enabled:
            return

        payload = {
            "ticket": close_data["ticket"],
            "symbol": close_data["symbol"],
            "type": close_data["type"],
            "volume": close_data["volume"],
            "entry_price": close_data["entry_price"],
            "exit_price": close_data["exit_price"],
            "profit": close_data["profit"],
            "duration_seconds": close_data.get("duration"),
            "close_reason": close_data.get("reason", "Manual"),  # "TP", "SL", "Manual"
            "timestamp": datetime.now().isoformat()
        }

        self._trigger('position-closed', payload)
        logger.info("Position closed: %s #%s P/L: $%.2f", payload['symbol'], payload['ticket'], payload['profit'])

    def emit_strategy_status(self, strategy_data: Dict[str, Any]) -> None:
        """Emit strategy status change."""
        if not self._enabled:
            return

        payload = {
            "strategyId": strategy_data["id"],
            "strategyName": strategy_data["name"],
            "status": strategy_data["status"],  # "started", "stopped", "error"
            "reason": strategy_data.get("reason"),
            "timestamp": datetime.now().isoformat()
        }

        self._trigger('strategy-status', payload)
        logger.info("Strategy %s: %s", payload['strategyName'], payload['status'])

    def emit_account_update(self, account_data: Dict[str, Any]) -> None:
        """Emit account balance/equity update with throttling."""
        global _last_account_update
        
        if not self._enabled:
            return

        # Throttle to max once per second
        now = time.time()
        if now - _last_account_update < 1.0:
            return
        _last_account_update = now

        payload = {
            "balance": account_data["balance"],
            "equity": account_data["equity"],
            "margin": account_data["margin"],
            "margin_level": account_data.get("margin_level", 0),
            "profit": account_data["profit"],
            "timestamp": datetime.now().isoformat()
        }

        self._trigger('account-update', payload)
        logger.debug("Account update emitted")

    def emit_error(self, error_data: Dict[str, Any]) -> None:
        """Emit error notification."""
        if not self._enabled:
            return

        payload = {
            "message": error_data["message"],
            "level": error_data.get("level", "error"),  # "warning" or "error"
            "source": error_data.get("source", "backend"),
            "timestamp": datetime.now().isoformat()
        }

        self._trigger('error', payload)
        logger.error("Error event emitted: %s", payload['message'])

    def _trigger(self, event_name: str, payload: Dict[str, Any]) -> None:
        """Internal method to trigger Pusher event."""
        if not self._pusher_client or not self._channel_name:
            return

        try:
            self._pusher_client.trigger(self._channel_name, event_name, payload)
        except Exception as exc:
            logger.debug("Failed to emit Pusher event %s: %s", event_name, exc)


__all__ = ["PusherEmitter"]
