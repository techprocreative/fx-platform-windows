"""Core backend services."""

from .mt5_client import MT5Client
from .pusher_client import PusherCommandClient
from .pusher_emitter import PusherEmitter
from .strategy_executor import StrategyExecutor

mt5_client = MT5Client()
pusher_client = PusherCommandClient()
pusher_emitter = PusherEmitter()
strategy_executor = StrategyExecutor(mt5_client=mt5_client, pusher_client=pusher_client, pusher_emitter=pusher_emitter)

__all__ = ["mt5_client", "pusher_client", "pusher_emitter", "strategy_executor", "MT5Client", "PusherCommandClient", "PusherEmitter", "StrategyExecutor"]
