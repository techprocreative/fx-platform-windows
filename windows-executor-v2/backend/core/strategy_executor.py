from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from database import session_scope
from ..database.models import StoredStrategy, TradeLog
from filters import SessionFilter, SpreadFilter, VolatilityFilter
from ..indicators.talib_wrapper import IndicatorCalculator
from models import ExecutorCommand, StrategyConfig, StrategyStatus, TradeExecutionResult
from condition_evaluator import ConditionEvaluator
from correlation_filter import CorrelationFilter
from dynamic_risk import DynamicRiskManager
from mtf_analyzer import MultiTimeframeAnalyzer
from news_filter import NewsFilter
from partial_exits import PartialExitManager
from platform_api import WebPlatformAPI
from regime_detector import MarketRegimeDetector
from risk_manager import RiskManager
from smart_exits import ExitLevels, SmartExitManager

logger = logging.getLogger(__name__)


class StrategyExecutor:
    """Main orchestration service responsible for strategy lifecycle."""

    def __init__(self, mt5_client, pusher_client, pusher_emitter=None) -> None:
        self.mt5_client = mt5_client
        self.pusher_client = pusher_client
        self.pusher_emitter = pusher_emitter

        self.condition_evaluator = ConditionEvaluator()
        self.indicator_calc = IndicatorCalculator()
        self.risk_manager = RiskManager()
        self.dynamic_risk = DynamicRiskManager()
        self.smart_exit_mgr = SmartExitManager()
        self.partial_exit_mgr = PartialExitManager(mt5_client)
        self.regime_detector = MarketRegimeDetector()
        self.mtf_analyzer = MultiTimeframeAnalyzer(mt5_client, self.indicator_calc)
        self.news_filter = NewsFilter()
        self.correlation_filter = CorrelationFilter(mt5_client)

        self.session_filter = SessionFilter()
        self.spread_filter = SpreadFilter(mt5_client)
        self.volatility_filter = VolatilityFilter(mt5_client, self.indicator_calc)

        self.platform_api = WebPlatformAPI()

        self.active_strategies: Dict[str, Dict[str, Any]] = {}
        self.open_positions: Dict[str, List[Dict[str, Any]]] = {}
        self._lock = asyncio.Lock()

    async def process_command(self, command: ExecutorCommand) -> Optional[StrategyStatus]:
        if command.command == "START_STRATEGY":
            strategy = StrategyConfig.model_validate(command.parameters)
            return await self.start_strategy(strategy)
        if command.command == "STOP_STRATEGY":
            strategy_id = command.parameters.get("strategyId") or command.metadata.get("strategyId")
            if strategy_id:
                return await self.stop_strategy(strategy_id)
            return None
        if command.command == "PING":
            logger.debug("Received PING command %s", command.id)
            return None
        logger.warning("Unsupported command type: %s", command.command)
        return None

    async def start_strategy(self, strategy: StrategyConfig) -> StrategyStatus:
        async with self._lock:
            if strategy.id in self.active_strategies:
                logger.info("Strategy %s already active", strategy.id)
            else:
                self.active_strategies[strategy.id] = {
                    "config": strategy,
                    "status": "active",
                    "started_at": datetime.now(timezone.utc),
                    "last_check": None,
                    "trades_count": 0,
                    "context": {},
                }
                self.open_positions.setdefault(strategy.id, [])
                logger.info("Started strategy %s (%s %s)", strategy.name, strategy.symbol, strategy.timeframe)
                self._persist_strategy(strategy)
                
                # Emit strategy status event
                if self.pusher_emitter:
                    self.pusher_emitter.emit_strategy_status({
                        "id": strategy.id,
                        "name": strategy.name,
                        "status": "started"
                    })

            return self._build_status(strategy.id)

    async def stop_strategy(self, strategy_id: str) -> Optional[StrategyStatus]:
        async with self._lock:
            data = self.active_strategies.get(strategy_id)
            if not data:
                return None
            data["status"] = "stopped"
            logger.info("Stopped strategy %s", strategy_id)
            
            # Emit strategy status event
            if self.pusher_emitter:
                config = data["config"]
                self.pusher_emitter.emit_strategy_status({
                    "id": strategy_id,
                    "name": config.name,
                    "status": "stopped"
                })
            
            return self._build_status(strategy_id)

    async def list_statuses(self) -> list[StrategyStatus]:
        async with self._lock:
            return [self._build_status(strategy_id) for strategy_id in self.active_strategies]

    async def run_cycle(self) -> None:
        async with self._lock:
            for strategy_id, data in list(self.active_strategies.items()):
                if data["status"] != "active":
                    continue
                payload = self._evaluate_strategy(data)
                if payload:
                    result = self._execute_trade(data, payload)
                    if result.success:
                        data["trades_count"] += 1
                data["last_check"] = datetime.now(timezone.utc)

            self._manage_open_positions()
            
            # Emit account update periodically
            if self.pusher_emitter:
                account_info = self.mt5_client.get_account_info()
                if account_info:
                    self.pusher_emitter.emit_account_update(account_info)

    def _evaluate_strategy(self, record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        config: StrategyConfig = record["config"]
        rules = config.rules or {}
        entry_rules = rules.get("entry", {})

        candles = self.mt5_client.get_candles(config.symbol, config.timeframe, count=300)
        if candles is None or candles.empty:
            return None

        indicators = self.indicator_calc.calculate_all(candles, entry_rules.get("conditions", []))
        record["context"]["indicators"] = indicators

        regime_result = self.regime_detector.detect_regime(candles)
        record["context"]["regime"] = regime_result

        mtf_config = rules.get("multiTimeframeAnalysis", {})
        mtf_result = self.mtf_analyzer.analyse(config.symbol, config.timeframe, mtf_config)
        if not mtf_result.confirmed:
            return None

        news_config = rules.get("newsFilter", {})
        if self.news_filter.check_news_blackout(config.symbol, news_config):
            return None

        corr_config = rules.get("correlationFilter", {})
        corr_result = self.correlation_filter.check_correlation(config.symbol, corr_config)
        if not corr_result.passed:
            return None
        record["context"]["correlation_action"] = corr_result

        session_config = rules.get("sessionFilter", {})
        if not self.session_filter.check(config.symbol, session_config):
            return None

        volatility_result = self.volatility_filter.check(config.symbol, rules.get("volatilityFilter", {}), candles)
        if not volatility_result.get("passed", True):
            return None
        record["context"]["volatility_action"] = volatility_result

        signal = self.condition_evaluator.evaluate(
            entry_rules.get("conditions", []),
            entry_rules.get("logic", "OR"),
            indicators,
            candles,
        )
        if not signal:
            return None

        record["context"]["last_signal"] = signal
        
        # Emit trading signal event
        if self.pusher_emitter:
            symbol_info = self.mt5_client.get_symbol_info(config.symbol)
            entry_price = symbol_info.get("ask") if signal == "BUY" else symbol_info.get("bid") if symbol_info else candles.iloc[-1]["close"]
            
            exit_levels = self._compute_exit_levels(config, rules, {
                "signal": signal,
                "candles": candles,
                "indicators": indicators
            }, symbol_info or {})
            
            self.pusher_emitter.emit_trading_signal({
                "symbol": config.symbol,
                "type": signal,
                "entry_price": float(entry_price),
                "stop_loss": exit_levels.stop_loss,
                "take_profit": exit_levels.take_profit,
                "strategy_name": config.name,
                "timeframe": config.timeframe,
                "rsi_value": indicators.get("rsi_14") or indicators.get("rsi"),
                "cci_value": indicators.get("cci_20") or indicators.get("cci"),
                "reason": f"{config.name} conditions met"
            })
        
        return {
            "signal": signal,
            "candles": candles,
            "indicators": indicators,
        }

    def _execute_trade(self, record: Dict[str, Any], payload: Dict[str, Any]) -> TradeExecutionResult:
        config: StrategyConfig = record["config"]
        rules = config.rules or {}

        spread_result = self.spread_filter.check(config.symbol, rules.get("spreadFilter", {}))
        if not spread_result.get("passed", True):
            return TradeExecutionResult(success=False, error="Spread filter blocked trade")

        account = self.mt5_client.get_account_info() or {}
        risk_rules = rules.get("riskManagement", {})
        market = {
            "atr": payload["indicators"].get("atr_14") or payload["indicators"].get("atr"),
            "volatility": payload["indicators"].get("atr_14", 1.0),
            "regime": record["context"].get("regime"),
        }

        if rules.get("dynamicRisk", {}).get("enabled", False):
            lot_size = self.dynamic_risk.calculate_position_size(account, rules.get("dynamicRisk", {}), market)
        else:
            lot_size = self.risk_manager.calculate_position_size(account, risk_rules)

        correlation_action = record["context"].get("correlation_action")
        if correlation_action and correlation_action.action == "reduce" and correlation_action.factor:
            lot_size *= correlation_action.factor

        if spread_result.get("action") == "reduce" and spread_result.get("factor"):
            lot_size *= spread_result["factor"]

        if lot_size <= 0:
            return TradeExecutionResult(success=False, error="Calculated lot size invalid")

        symbol_info = self.mt5_client.get_symbol_info(config.symbol)
        if not symbol_info:
            return TradeExecutionResult(success=False, error="Symbol info unavailable")

        exit_levels = self._compute_exit_levels(config, rules, payload, symbol_info)

        result_dict = self.mt5_client.open_position(
            symbol=config.symbol,
            order_type=payload["signal"],
            lot_size=lot_size,
            stop_loss=exit_levels.stop_loss,
            take_profit=exit_levels.take_profit,
            comment=config.name,
        )

        result = TradeExecutionResult(**result_dict)
        if result.success:
            position_data = {
                "ticket": result.ticket,
                "symbol": config.symbol,
                "type": payload["signal"],
                "volume": lot_size,
                "openPrice": result.price,
                "stopLoss": exit_levels.stop_loss,
                "takeProfit": exit_levels.take_profit,
                "strategyId": config.id,
                "entryTime": datetime.now(timezone.utc),
                "point": symbol_info.get("point", 0.0001),
            }
            self._register_open_position(config.id, position_data)
            
            # Emit position opened event
            if self.pusher_emitter:
                self.pusher_emitter.emit_position_opened({
                    "ticket": result.ticket,
                    "symbol": config.symbol,
                    "type": payload["signal"],
                    "volume": lot_size,
                    "entry_price": result.price,
                    "stop_loss": exit_levels.stop_loss,
                    "take_profit": exit_levels.take_profit,
                    "strategy_name": config.name
                })

            enhanced_exits = rules.get("exit", {}).get("enhancedPartialExits", {})
            if enhanced_exits.get("enabled", False):
                self.partial_exit_mgr.setup_exit_levels(self.open_positions[config.id][-1], enhanced_exits)

        return result

    def _compute_exit_levels(
        self,
        config: StrategyConfig,
        rules: Dict,
        payload: Dict[str, Any],
        symbol_info: Dict,
    ) -> ExitLevels:
        exit_rules = rules.get("exit", {})
        entry_price = symbol_info.get("ask") if payload["signal"] == "BUY" else symbol_info.get("bid")
        entry_price = float(entry_price or payload["candles"].iloc[-1]["close"])
        return self.smart_exit_mgr.calculate_levels(
            direction=payload["signal"],
            entry_price=entry_price,
            exit_config=exit_rules,
            candles=payload["candles"],
            symbol_info=symbol_info,
        )

    def _register_open_position(self, strategy_id: str, position: Dict[str, Any]) -> None:
        self.open_positions.setdefault(strategy_id, [])
        self.open_positions[strategy_id].append(position)
        self._record_trade_open(strategy_id, position)

    def _manage_open_positions(self) -> None:
        current_positions = {pos["ticket"]: pos for pos in self.mt5_client.get_positions()}

        for strategy_id, positions in list(self.open_positions.items()):
            record = self.active_strategies.get(strategy_id)
            rules = record["config"].rules if record else {}
            trailing_config = (rules or {}).get("exit", {}).get("trailing", {})
            for stored in list(positions):
                live_position = current_positions.get(stored["ticket"])
                if not live_position:
                    close_price = stored.get("currentPrice", stored.get("openPrice", 0))
                    self._record_trade_close(stored.get("ticket"), close_price)
                    self.dynamic_risk.register_trade(stored.get("profit", 0))
                    
                    # Emit position closed event
                    if self.pusher_emitter:
                        entry_time = stored.get("entryTime")
                        duration = (datetime.now(timezone.utc) - entry_time).total_seconds() if entry_time else None
                        self.pusher_emitter.emit_position_closed({
                            "ticket": stored.get("ticket"),
                            "symbol": stored.get("symbol"),
                            "type": stored.get("type"),
                            "volume": stored.get("volume"),
                            "entry_price": stored.get("openPrice"),
                            "exit_price": close_price,
                            "profit": stored.get("profit", 0),
                            "duration": duration,
                            "reason": "Manual"
                        })
                    
                    positions.remove(stored)
                    continue

                stored.update(live_position)

                if trailing_config.get("enabled", False):
                    new_stop = self.smart_exit_mgr.update_trailing_stop(
                        stored,
                        live_position["currentPrice"],
                        trailing_config,
                        {"point": stored.get("point", 0.0001), "digits": live_position.get("digits", 5)},
                    )
                    if new_stop:
                        response = self.mt5_client.modify_position_sl_tp(stored["ticket"], stop_loss=new_stop)
                        if response.get("success"):
                            stored["stopLoss"] = new_stop
                        else:
                            logger.debug("Failed to update trailing stop: %s", response.get("error"))

                partial_result = self.partial_exit_mgr.check_partial_exits(
                    stored,
                    live_position["currentPrice"],
                )
                if partial_result and partial_result.get("success"):
                    stored["volume"] -= partial_result.get("exitLots", 0)
                    if stored["volume"] <= 0:
                        close_price = live_position.get("currentPrice", stored.get("openPrice", 0))
                        self._record_trade_close(stored.get("ticket"), close_price)
                        self.dynamic_risk.register_trade(live_position.get("profit", 0))
                        
                        # Emit position closed event
                        if self.pusher_emitter:
                            entry_time = stored.get("entryTime")
                            duration = (datetime.now(timezone.utc) - entry_time).total_seconds() if entry_time else None
                            self.pusher_emitter.emit_position_closed({
                                "ticket": stored.get("ticket"),
                                "symbol": stored.get("symbol"),
                                "type": stored.get("type"),
                                "volume": stored.get("volume") + partial_result.get("exitLots", 0),
                                "entry_price": stored.get("openPrice"),
                                "exit_price": close_price,
                                "profit": live_position.get("profit", 0),
                                "duration": duration,
                                "reason": "PartialExit"
                            })
                        
                        positions.remove(stored)

            if not positions:
                self.open_positions.pop(strategy_id, None)

    def _persist_strategy(self, strategy: StrategyConfig) -> None:
        try:
            with session_scope() as session:
                model = session.get(StoredStrategy, strategy.id)
                payload = strategy.model_dump(by_alias=True)
                if model:
                    model.name = strategy.name
                    model.symbol = strategy.symbol
                    model.timeframe = strategy.timeframe
                    model.payload = payload
                else:
                    session.add(
                        StoredStrategy(
                            id=strategy.id,
                            name=strategy.name,
                            symbol=strategy.symbol,
                            timeframe=strategy.timeframe,
                            payload=payload,
                        )
                    )
        except Exception as exc:  # pragma: no cover
            logger.debug("Failed to persist strategy %s: %s", strategy.id, exc)

    def _record_trade_open(self, strategy_id: str, position: Dict[str, Any]) -> None:
        try:
            with session_scope() as session:
                session.add(
                    TradeLog(
                        strategy_id=strategy_id,
                        ticket=str(position.get("ticket")),
                        direction=position.get("type", ""),
                        volume=f"{position.get('volume', 0):.2f}",
                        open_price=f"{position.get('openPrice', 0):.5f}",
                        extra={
                            "stopLoss": position.get("stopLoss"),
                            "takeProfit": position.get("takeProfit"),
                        },
                    )
                )
        except Exception as exc:  # pragma: no cover
            logger.debug("Failed to record trade open: %s", exc)

        # Report to platform asynchronously
        asyncio.create_task(
            self.platform_api.report_trade(
                {
                    "strategyId": strategy_id,
                    "ticket": position.get("ticket"),
                    "symbol": position.get("symbol"),
                    "type": position.get("type"),
                    "lots": position.get("volume"),
                    "openPrice": position.get("openPrice"),
                    "stopLoss": position.get("stopLoss"),
                    "takeProfit": position.get("takeProfit"),
                    "openTime": position.get("openTime", datetime.now(timezone.utc).isoformat()),
                }
            )
        )

    def _record_trade_close(self, ticket: Optional[int], close_price: float) -> None:
        if ticket is None:
            return
        try:
            with session_scope() as session:
                trade = (
                    session.query(TradeLog)
                    .filter(TradeLog.ticket == str(ticket))
                    .order_by(TradeLog.id.desc())
                    .first()
                )
                if trade:
                    trade.close_price = f"{close_price:.5f}"
        except Exception as exc:  # pragma: no cover
            logger.debug("Failed to record trade close: %s", exc)

    def _build_status(self, strategy_id: str) -> StrategyStatus:
        record = self.active_strategies[strategy_id]
        config: StrategyConfig = record["config"]
        return StrategyStatus(
            id=config.id,
            name=config.name,
            symbol=config.symbol,
            timeframe=config.timeframe,
            status=record["status"],
            started_at=record["started_at"],
            last_check=record["last_check"],
            trades_count=record["trades_count"],
        )


__all__ = ["StrategyExecutor"]
